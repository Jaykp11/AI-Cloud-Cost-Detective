# ☁️ AI Cloud Cost Detective

**An AI-powered AWS cloud cost analysis and resource monitoring tool.**

AI Cloud Cost Detective is a web application that helps users understand their AWS cloud resources and identify potential opportunities to reduce cloud costs.

It connects to an AWS account, collects information about cloud resources and billing, and uses AI to analyze the collected data. Users can view analysis results, potential cost-saving recommendations, and reports through a simple dashboard.

## 🚀 Key Features

- **AWS Resource Scanning:** Scans supported AWS services and collects resource information.
- **Cost Analysis:** Retrieves AWS billing information using AWS Cost Explorer.
- **AI-Powered Insights:** Uses Ollama and Llama 3.2 to analyze collected data and generate understandable insights.
- **Cost Optimization:** Highlights potential areas where AWS spending could be reduced.
- **Live Progress Tracking:** Displays analysis progress in real time using WebSockets.
- **User Authentication:** Supports user registration and login.
- **Analysis History:** Stores previous analyses so users can review their results.
- **Dashboard:** Displays resource information, findings, and recommendations.

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| React.js | Building the frontend |
| TypeScript | Type-safe frontend development |
| Tailwind CSS | Styling the application |
| Python | Backend programming |
| FastAPI | Building REST APIs |
| PostgreSQL | Storing users and analysis history |
| Docker | Running the PostgreSQL database |
| AWS SDK (Boto3) | Connecting to AWS services |
| AWS Cost Explorer | Retrieving cloud billing information |
| Ollama | Running the local AI model |
| Llama 3.2 | Generating AI-powered insights |
| JWT | User authentication |
| WebSockets | Real-time analysis progress |

## 🏗️ System Architecture

The application follows a simple frontend-backend architecture.

```text
                 USER
                   |
                   v
          REACT FRONTEND
          (React + TypeScript)
                   |
                   | HTTP API / WebSocket
                   v
            FASTAPI BACKEND
                   |
          +--------+---------+
          |        |         |
          v        v         v
       AWS SDK   PostgreSQL  Ollama
          |        |         |
          v        |         v
      AWS SERVICES |      Llama 3.2
                   |
                   v
             DATABASE
```

**How the components work together:**

- **Frontend:** Provides the dashboard where users log in, start scans, and view results.
- **Backend:** Handles authentication, AWS scanning, cost analysis, and communication between services.
- **AWS:** Provides cloud resource and billing information.
- **PostgreSQL:** Stores user information and analysis history.
- **Ollama:** Runs the local AI model to generate insights from the collected information.

## 🔄 Request Flow

Here is how a typical analysis works:

1. The user registers or logs into the application.
2. The user selects an AWS region and starts an analysis.
3. The frontend sends a request to the FastAPI backend.
4. The backend connects to AWS using the configured credentials.
5. AWS resource information and billing data are collected.
6. The collected information is processed and sent to the AI model.
7. Ollama analyzes the data and generates insights.
8. The backend stores the analysis results in PostgreSQL.
9. The frontend receives live progress updates through WebSockets.
10. The completed analysis and recommendations are displayed on the dashboard.

## 🔍 What Does It Detect?

The application scans supported AWS services, including:

| AWS Service | What It Checks |
|---|---|
| EC2 | Virtual machine instances |
| S3 | Storage buckets |
| Lambda | Serverless functions |
| RDS | Managed relational databases |
| ECS | Container services |
| ECR | Container image repositories |
| ELB | Load balancers |
| CloudWatch | Monitoring information |
| Cost Explorer | AWS spending and billing information |

Based on the information available, the application helps identify potential cost-related concerns and optimization opportunities.

Examples include:

- Cloud resources that may not be needed.
- Resources that could potentially be optimized.
- AWS spending patterns.
- Services contributing to cloud expenses.
- Possible opportunities to reduce unnecessary spending.

**Note:** The findings depend on the resources present in the AWS account, the selected region, available billing data, and the permissions granted to the application. Recommendations should be reviewed before making changes to AWS resources.

## 📋 Prerequisites

Before running the project, install the following:

| Software | Purpose |
|---|---|
| Python 3.13 | Backend development |
| Node.js and npm | Frontend development |
| Docker Desktop | Running PostgreSQL |
| AWS CLI | Configuring AWS access |
| Ollama | Running the local AI model |
| Git | Cloning the repository |

You will also need:

- An AWS account.
- AWS credentials with appropriate read-only permissions.
- AWS Cost Explorer access.
- Sufficient local storage and memory to run the application and AI model.

## ⚙️ Installation and Setup

### 1. Clone the Repository

```bash
git clone https://github.com/Jaykp11/AI-Cloud-Cost-Detective.git
```

Navigate into the project:

```bash
cd AI-Cloud-Cost-Detective
```

### 2. Start PostgreSQL Using Docker

From the project root directory, run:

```bash
docker compose up -d
```

Check whether the database container is running:

```bash
docker ps
```

### 3. Configure the Backend

Open a new terminal:

```bash
cd backend
```

Create a Python virtual environment:

```bash
python -m venv .venv
```

Activate it in Git Bash:

```bash
source .venv/Scripts/activate
```

Install the required Python packages:

```bash
python -m pip install -r requirements.txt
```

Create your backend environment file:

```bash
cp .env.example .env
```

Open `backend/.env` and configure the required settings, including:

- Database connection URL.
- JWT authentication secret.
- Ollama connection URL.
- Any other backend configuration required by the application.

Use the values and variable names provided in `.env.example`.

**Important:** Never upload your actual `.env` file or AWS credentials to GitHub.

### 4. Configure AWS Credentials

Install and configure the AWS CLI.

Run:

```bash
aws configure
```

Enter your AWS access key, secret access key, default region, and output format when prompted.

For example, the region can be:

```text
ap-south-1
```

Verify your AWS connection:

```bash
aws sts get-caller-identity
```

If the command returns your AWS account information, your credentials are configured.

The application requires appropriate permissions to read supported AWS resource information and access Cost Explorer.

For security, use an IAM identity with the minimum required read-only permissions rather than AWS root credentials.

### 5. Configure Ollama

Install Ollama from:

https://ollama.com/

Download the AI model:

```bash
ollama pull llama3.2
```

Verify the model is available:

```bash
ollama list
```

Make sure Ollama is running and that the backend's Ollama URL matches your local setup.

### 6. Start the Backend

From the `backend` directory, activate the virtual environment if it is not already active:

```bash
source .venv/Scripts/activate
```

Start FastAPI:

```bash
python -m uvicorn main:app --reload
```

Backend API:

http://127.0.0.1:8000

API documentation:

http://127.0.0.1:8000/docs

### 7. Configure and Start the Frontend

Open another terminal:

```bash
cd frontend
```

Install frontend dependencies:

```bash
npm install
```

Create the frontend environment file:

```bash
cp .env.example .env
```

Check that the API URL points to your running backend:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Start the frontend:

```bash
npm run dev
```

Open the application in your browser:

http://localhost:5173

## 💡 How It Works

In simple terms, AI Cloud Cost Detective works in four main stages:

**1. Connect**

The application connects to your AWS account using your configured credentials.

**2. Collect**

It gathers information about supported AWS resources and retrieves available billing data.

**3. Analyze**

The backend processes the collected information and uses the local Llama 3.2 model through Ollama to generate insights.

**4. Display**

The results are saved in PostgreSQL and displayed on the dashboard, where users can review findings and recommendations.

## 🔐 Security

- JWT-based authentication.
- User-specific analysis history.
- Environment variables for sensitive configuration.
- AWS access through configured credentials.
- No need to provide AWS root credentials.
- Local AI inference through Ollama.

Never commit AWS credentials, JWT secrets, database passwords, or actual `.env` files to GitHub.

## 📁 Project Structure

```text
AI-Cloud-Cost-Detective/
│
├── backend/
│   ├── main.py
│   ├── auth.py
│   ├── db.py
│   ├── aws_scanner.py
│   ├── ai_analyzer.py
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── lib/
│   │   └── pages/
│   ├── package.json
│   └── .env.example
│
├── docker-compose.yml
├── Architecture.MD
├── RequestFlow.MD
└── README.md
```

## 🎯 Project Objective

The main objective of this project is to make AWS cloud cost analysis easier to understand.

Instead of manually checking different AWS services and billing information, users can use a single dashboard to collect resource information, analyze cloud spending, and receive AI-generated insights.
