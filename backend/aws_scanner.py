import json
import shutil
import subprocess

from datetime import date, timedelta
from typing import Any


# ============================================================
# Custom Exceptions
# ============================================================

class AWSScannerError(Exception):
    """Base exception for AWS scanner errors."""


class AWSCLINotInstalledError(AWSScannerError):
    """Raised when AWS CLI is not installed or unavailable."""


class AWSCredentialsError(AWSScannerError):
    """Raised when AWS credentials are missing, invalid, or expired."""


class AWSPermissionError(AWSScannerError):
    """Raised when AWS denies an operation."""


class AWSCommandError(AWSScannerError):
    """Raised when an AWS CLI command fails."""


# ============================================================
# Supported AWS Services
# ============================================================

SERVICE_SCANNERS = {
    "Amazon Elastic Compute Cloud - Compute": "ec2",
    "Amazon Elastic Compute Cloud": "ec2",
    "Amazon Relational Database Service": "rds",
    "Amazon Simple Storage Service": "s3",
    "AWS Lambda": "lambda",
    "Amazon Elastic Container Service": "ecs",
    "Amazon Elastic Container Registry": "ecr",
    "Amazon Elastic Load Balancing": "elbv2",
    "Amazon CloudWatch": "cloudwatch",
}


# ============================================================
# AWS Scanner
# ============================================================

class AWSScanner:

    def __init__(self, region: str):

        self.region = region.strip()

        if not self.region:
            raise ValueError("AWS region cannot be empty.")

        if not shutil.which("aws"):
            raise AWSCLINotInstalledError(
                "AWS CLI was not found. "
                "Install AWS CLI and ensure it is on PATH."
            )

    # ========================================================
    # AWS CLI Execution
    # ========================================================

    def _run_command(
        self,
        args: list[str],
        region: str | None = None,
    ) -> dict[str, Any]:

        command_region = region or self.region

        command = [
            "aws",
            *args,
            "--region",
            command_region,
            "--output",
            "json",
            "--no-cli-pager",
        ]

        try:

            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=120,
                check=False,
            )

        except subprocess.TimeoutExpired as exc:

            raise AWSCommandError(
                f"AWS CLI command timed out: {args[0]}"
            ) from exc

        except OSError as exc:

            raise AWSCommandError(
                f"Unable to execute AWS CLI: {exc}"
            ) from exc

        if result.returncode != 0:

            error = result.stderr.strip()
            low = error.lower()

            credential_errors = (
                "unable to locate credentials",
                "could not find credentials",
                "no credentials",
                "expiredtoken",
                "invalidclienttokenid",
                "signaturedoesnotmatch",
                "the security token included in the request is invalid",
                "your session has expired",
            )

            permission_errors = (
                "accessdenied",
                "unauthorizedoperation",
                "not authorized",
                "access denied",
                "forbidden",
            )

            if any(
                message in low
                for message in credential_errors
            ):

                raise AWSCredentialsError(
                    "AWS credentials are missing, invalid, "
                    "or expired. Refresh your AWS session."
                )

            if any(
                message in low
                for message in permission_errors
            ):

                raise AWSPermissionError(
                    f"AWS denied the operation "
                    f"'{args[0]}'. Check IAM permissions. "
                    f"Details: {error[:500]}"
                )

            raise AWSCommandError(
                f"AWS CLI command failed "
                f"('{args[0]}'): {error[:1000]}"
            )

        try:

            return json.loads(
                result.stdout or "{}"
            )

        except json.JSONDecodeError as exc:

            raise AWSCommandError(
                "AWS CLI returned invalid JSON."
            ) from exc

    # ========================================================
    # Cost Explorer
    # ========================================================

    def discover_active_services(
        self,
    ) -> dict[str, float]:

        today = date.today()

        start_date = today.replace(
            day=1
        ).isoformat()

        # Cost Explorer's End date is exclusive.
        end_date = (
            today + timedelta(days=1)
        ).isoformat()

        response = self._run_command(
            [
                "ce",
                "get-cost-and-usage",
                "--time-period",
                (
                    f"Start={start_date},"
                    f"End={end_date}"
                ),
                "--granularity",
                "MONTHLY",
                "--metrics",
                "UnblendedCost",
                "--group-by",
                "Type=DIMENSION,Key=SERVICE",
            ],
            region="us-east-1",
        )

        costs: dict[str, float] = {}

        for period in response.get(
            "ResultsByTime", []
        ):

            groups = period.get(
                "Groups", []
            )

            for group in groups:

                keys = group.get(
                    "Keys", []
                )

                if not keys:
                    continue

                service_name = keys[0]

                amount = float(
                    group.get(
                        "Metrics", {}
                    )
                    .get(
                        "UnblendedCost", {}
                    )
                    .get(
                        "Amount", 0
                    )
                )

                costs[service_name] = (
                    costs.get(service_name, 0.0)
                    + amount
                )

        # Retain only services with positive costs.
        # Resource discovery runs independently below.
        return {
            name: amount
            for name, amount in costs.items()
            if amount > 0
        }

    # ========================================================
    # Resource Normalization
    # ========================================================

    def _resource(
        self,
        service: str,
        resource_type: str,
        identifier: str,
        name: str | None,
        specifications: dict[str, Any],
        tags: Any,
    ) -> dict[str, Any]:

        if isinstance(tags, list):

            normalized_tags = [
                {
                    "key": tag.get(
                        "Key",
                        tag.get("key", ""),
                    ),
                    "value": tag.get(
                        "Value",
                        tag.get("value", ""),
                    ),
                }
                for tag in tags
            ]

        elif isinstance(tags, dict):

            normalized_tags = [
                {
                    "key": key,
                    "value": value,
                }
                for key, value in tags.items()
            ]

        else:

            normalized_tags = []

        return {
            "service": service,
            "resource_type": resource_type,
            "identifier": identifier,
            "name": name or identifier,
            "region": self.region,
            "specifications": specifications,
            "tags": normalized_tags,
            "tagged": bool(normalized_tags),
        }

    # ========================================================
    # EC2 Scanner
    # ========================================================

    def scan_ec2(self):

        response = self._run_command(
            [
                "ec2",
                "describe-instances",
            ]
        )

        resources = []

        for reservation in response.get(
            "Reservations", []
        ):

            for instance in reservation.get(
                "Instances", []
            ):

                instance_id = instance.get(
                    "InstanceId",
                    "unknown",
                )

                tags = instance.get(
                    "Tags", []
                )

                name = next(
                    (
                        tag.get("Value")
                        for tag in tags
                        if tag.get("Key") == "Name"
                    ),
                    instance_id,
                )

                specifications = {
                    "instance_type": instance.get(
                        "InstanceType"
                    ),
                    "state": instance.get(
                        "State", {}
                    ).get("Name"),
                    "availability_zone": instance.get(
                        "Placement", {}
                    ).get("AvailabilityZone"),
                    "vpc_id": instance.get(
                        "VpcId"
                    ),
                    "subnet_id": instance.get(
                        "SubnetId"
                    ),
                    "private_ip": instance.get(
                        "PrivateIpAddress"
                    ),
                    "public_ip": instance.get(
                        "PublicIpAddress"
                    ),
                    "launch_time": instance.get(
                        "LaunchTime"
                    ),
                }

                resources.append(
                    self._resource(
                        "ec2",
                        "EC2 Instance",
                        instance_id,
                        name,
                        specifications,
                        tags,
                    )
                )

        return resources

    # ========================================================
    # RDS Scanner
    # ========================================================

    def scan_rds(self):

        response = self._run_command(
            [
                "rds",
                "describe-db-instances",
            ]
        )

        resources = []

        for database in response.get(
            "DBInstances", []
        ):

            arn = database.get(
                "DBInstanceArn", ""
            )

            tags = []

            if arn:

                tags = self._run_command(
                    [
                        "rds",
                        "list-tags-for-resource",
                        "--resource-name",
                        arn,
                    ]
                ).get(
                    "TagList", []
                )

            identifier = database.get(
                "DBInstanceIdentifier",
                "unknown",
            )

            specifications = {
                "engine": database.get(
                    "Engine"
                ),
                "engine_version": database.get(
                    "EngineVersion"
                ),
                "instance_class": database.get(
                    "DBInstanceClass"
                ),
                "status": database.get(
                    "DBInstanceStatus"
                ),
                "storage_type": database.get(
                    "StorageType"
                ),
                "allocated_storage_gb": database.get(
                    "AllocatedStorage"
                ),
                "multi_az": database.get(
                    "MultiAZ"
                ),
                "publicly_accessible": database.get(
                    "PubliclyAccessible"
                ),
                "availability_zone": database.get(
                    "AvailabilityZone"
                ),
            }

            resources.append(
                self._resource(
                    "rds",
                    "RDS Instance",
                    identifier,
                    identifier,
                    specifications,
                    tags,
                )
            )

        return resources

    # ========================================================
    # S3 Scanner
    # ========================================================

    def scan_s3(self):

        response = self._run_command(
            [
                "s3api",
                "list-buckets",
            ]
        )

        resources = []

        for bucket in response.get(
            "Buckets", []
        ):

            name = bucket.get(
                "Name", "unknown"
            )

            location_response = self._run_command(
                [
                    "s3api",
                    "get-bucket-location",
                    "--bucket",
                    name,
                ]
            )

            location = (
                location_response.get(
                    "LocationConstraint"
                )
                or "us-east-1"
            )

            if location == "EU":
                location = "eu-west-1"

            if location != self.region:
                continue

            try:

                tags = self._run_command(
                    [
                        "s3api",
                        "get-bucket-tagging",
                        "--bucket",
                        name,
                    ]
                ).get(
                    "TagSet", []
                )

            except AWSCommandError as exc:

                if "NoSuchTagSet" not in str(exc):
                    raise

                tags = []

            specifications = {
                "creation_date": bucket.get(
                    "CreationDate"
                ),
                "region": location,
            }

            resources.append(
                self._resource(
                    "s3",
                    "S3 Bucket",
                    name,
                    name,
                    specifications,
                    tags,
                )
            )

        return resources

    # ========================================================
    # Lambda Scanner
    # ========================================================

    def scan_lambda(self):

        response = self._run_command(
            [
                "lambda",
                "list-functions",
            ]
        )

        resources = []

        for function in response.get(
            "Functions", []
        ):

            arn = function.get(
                "FunctionArn", ""
            )

            tags = {}

            if arn:

                tags = self._run_command(
                    [
                        "lambda",
                        "list-tags",
                        "--resource",
                        arn,
                    ]
                ).get(
                    "Tags", {}
                )

            name = function.get(
                "FunctionName",
                "unknown",
            )

            specifications = {
                "runtime": function.get(
                    "Runtime"
                ),
                "memory_mb": function.get(
                    "MemorySize"
                ),
                "timeout_seconds": function.get(
                    "Timeout"
                ),
                "architecture": function.get(
                    "Architectures"
                ),
                "last_modified": function.get(
                    "LastModified"
                ),
            }

            resources.append(
                self._resource(
                    "lambda",
                    "Lambda Function",
                    arn or name,
                    name,
                    specifications,
                    tags,
                )
            )

        return resources

    # ========================================================
    # Elastic Load Balancing Scanner
    # ========================================================

    def scan_elbv2(self):

        response = self._run_command(
            [
                "elbv2",
                "describe-load-balancers",
            ]
        )

        resources = []

        for load_balancer in response.get(
            "LoadBalancers", []
        ):

            arn = load_balancer.get(
                "LoadBalancerArn", ""
            )

            tags = []

            if arn:

                tag_response = self._run_command(
                    [
                        "elbv2",
                        "describe-tags",
                        "--resource-arns",
                        arn,
                    ]
                )

                for entry in tag_response.get(
                    "TagDescriptions", []
                ):

                    tags.extend(
                        entry.get("Tags", [])
                    )

            name = load_balancer.get(
                "LoadBalancerName",
                "unknown",
            )

            specifications = {
                "type": load_balancer.get(
                    "Type"
                ),
                "scheme": load_balancer.get(
                    "Scheme"
                ),
                "state": load_balancer.get(
                    "State", {}
                ).get("Code"),
                "vpc_id": load_balancer.get(
                    "VpcId"
                ),
                "dns_name": load_balancer.get(
                    "DNSName"
                ),
            }

            resources.append(
                self._resource(
                    "elbv2",
                    "Load Balancer",
                    arn or name,
                    name,
                    specifications,
                    tags,
                )
            )

        return resources

    # ========================================================
    # ECR Scanner
    # ========================================================

    def scan_ecr(self):

        response = self._run_command(
            [
                "ecr",
                "describe-repositories",
            ]
        )

        resources = []

        for repository in response.get(
            "repositories", []
        ):

            arn = repository.get(
                "repositoryArn", ""
            )

            tags = []

            if arn:

                tags = self._run_command(
                    [
                        "ecr",
                        "list-tags-for-resource",
                        "--resource-arn",
                        arn,
                    ]
                ).get(
                    "tags", []
                )

            name = repository.get(
                "repositoryName",
                "unknown",
            )

            specifications = {
                "repository_uri": repository.get(
                    "repositoryUri"
                ),
                "image_tag_mutability": repository.get(
                    "imageTagMutability"
                ),
                "image_scanning_configuration": repository.get(
                    "imageScanningConfiguration"
                ),
                "created_at": repository.get(
                    "createdAt"
                ),
            }

            resources.append(
                self._resource(
                    "ecr",
                    "ECR Repository",
                    arn or name,
                    name,
                    specifications,
                    tags,
                )
            )

        return resources

    # ========================================================
    # ECS Scanner
    # ========================================================

    def scan_ecs(self):

        response = self._run_command(
            [
                "ecs",
                "list-clusters",
            ]
        )

        resources = []

        for arn in response.get(
            "clusterArns", []
        ):

            detail = self._run_command(
                [
                    "ecs",
                    "describe-clusters",
                    "--clusters",
                    arn,
                    "--include",
                    "TAGS",
                ]
            )

            for cluster in detail.get(
                "clusters", []
            ):

                specifications = {
                    "status": cluster.get(
                        "status"
                    ),
                    "running_tasks": cluster.get(
                        "runningTasksCount"
                    ),
                    "pending_tasks": cluster.get(
                        "pendingTasksCount"
                    ),
                    "active_services": cluster.get(
                        "activeServicesCount"
                    ),
                }

                resources.append(
                    self._resource(
                        "ecs",
                        "ECS Cluster",
                        cluster.get(
                            "clusterArn",
                            arn,
                        ),
                        cluster.get(
                            "clusterName"
                        ),
                        specifications,
                        cluster.get(
                            "tags", []
                        ),
                    )
                )

        return resources

    # ========================================================
    # CloudWatch Scanner
    # ========================================================

    def scan_cloudwatch(self):

        response = self._run_command(
            [
                "cloudwatch",
                "describe-alarms",
            ]
        )

        resources = []

        for alarm in response.get(
            "MetricAlarms", []
        ):

            name = alarm.get(
                "AlarmName",
                "unknown",
            )

            arn = alarm.get(
                "AlarmArn",
                name,
            )

            tags = self._run_command(
                [
                    "cloudwatch",
                    "list-tags-for-resource",
                    "--resource-arn",
                    arn,
                ]
            ).get(
                "Tags", []
            )

            specifications = {
                "state": alarm.get(
                    "StateValue"
                ),
                "metric_name": alarm.get(
                    "MetricName"
                ),
                "namespace": alarm.get(
                    "Namespace"
                ),
                "threshold": alarm.get(
                    "Threshold"
                ),
                "comparison_operator": alarm.get(
                    "ComparisonOperator"
                ),
            }

            resources.append(
                self._resource(
                    "cloudwatch",
                    "CloudWatch Alarm",
                    arn,
                    name,
                    specifications,
                    tags,
                )
            )

        return resources

    # ========================================================
    # Main Analysis
    # ========================================================

    def analyze(self):

        today = date.today()

        billing_start = today.replace(
            day=1
        ).isoformat()

        billing_end = (
            today + timedelta(days=1)
        ).isoformat()

        active = {}
        billing_error = None

        # ----------------------------------------------------
        # Step 1: Query Cost Explorer independently.
        # ----------------------------------------------------

        try:

            active = self.discover_active_services()

        except (
            AWSPermissionError,
            AWSCommandError,
        ) as exc:

            # A billing-query failure should not automatically
            # prevent regional resource discovery.
            billing_error = {
                "type": type(exc).__name__,
                "message": str(exc),
            }

        # ----------------------------------------------------
        # Step 2: Define all supported resource scanners.
        # ----------------------------------------------------

        scanners = {
            "ec2": self.scan_ec2,
            "rds": self.scan_rds,
            "s3": self.scan_s3,
            "lambda": self.scan_lambda,
            "ecs": self.scan_ecs,
            "ecr": self.scan_ecr,
            "elbv2": self.scan_elbv2,
            "cloudwatch": self.scan_cloudwatch,
        }

        resources = []
        scanned = []
        errors = []

        # ----------------------------------------------------
        # Step 3: Scan all supported services regardless
        # of whether Cost Explorer reports positive costs.
        # ----------------------------------------------------

        for scanner_name, scanner_function in scanners.items():

            try:

                found = scanner_function()

                resources.extend(found)

                scanned.append(
                    {
                        "scanner": scanner_name,
                        "resource_count": len(found),
                        "status": "success",
                    }
                )

            except (
                AWSPermissionError,
                AWSCommandError,
            ) as exc:

                errors.append(
                    {
                        "service": scanner_name,
                        "error": str(exc),
                        "type": type(exc).__name__,
                    }
                )

                scanned.append(
                    {
                        "scanner": scanner_name,
                        "status": "failed",
                    }
                )

        # ----------------------------------------------------
        # Step 4: Determine whether the analysis is complete.
        # ----------------------------------------------------

        complete = (
            billing_error is None
            and len(errors) == 0
        )

        # ----------------------------------------------------
        # Step 5: Build the final response.
        # ----------------------------------------------------

        return {
            "region": self.region,

            "billing_period": {
                "start": billing_start,
                "end_exclusive": billing_end,
                "metric": "UnblendedCost",
            },

            "active_services": [
                {
                    "service": name,
                    "unblended_cost": amount,
                }
                for name, amount in active.items()
            ],

            "billing_error": billing_error,

            "scanned_services": scanned,

            "unsupported_services": [],

            "resources": resources,

            "resource_count": len(resources),

            "scan_errors": errors,

            "complete": complete,
        }