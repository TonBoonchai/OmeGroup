

# OmeGroup
**Random Group Video Chat Platform**

---

## 🚀 Getting Started (Infrastructure)
To run Terraform, you must first configure your AWS environment.

### 1. Generate IAM Keys
1. **Login:** Access the [AWS Management Console](https://console.aws.amazon.com/).
2. **Navigate:** Search for **IAM** and select it.
3. **Create User:** Go to **Users** > **Create user**.
   * **User name:** `terraform-admin`.
4. **Permissions:** Choose **Attach policies directly**, search for **AdministratorAccess**, and check the box.
5. **Security Credentials:**
   * Select the `terraform-admin` user.
   * Open the **Security credentials** tab.
   * Scroll to **Access keys** > **Create access key**.
   * Select **Command Line Interface (CLI)**.
   * **STOP:** Copy your **Access Key ID** and **Secret Access Key** now.

### 2. Link Terminal to AWS
Run this command in your terminal:
`aws configure`

**Fill in the prompts:**
* **AWS Access Key ID:** [Paste Key]
* **AWS Secret Access Key:** [Paste Secret]
* **Default region name:** `us-east-1`
* **Default output format:** `json`

### 3. Verify and Run
Configure terraform variables then
Execute these commands in order:
* `aws sts get-caller-identity` (Verify Identity)
* `terraform init` (Initialize)
* `terraform plan` (Plan)
* `terraform apply` (Deploy)

---

## 🦀 Backend
**Note:** You must deploy Terraform first.

**Prerequisites (Windows):**
* `scoop install zig`
* `cargo install cargo-lambda`
* `pip install ziglang`
* `cargo install cargo-zigbuild`

**Compile and Deploy:**
1. `cargo lambda build --release --compiler cargo-zigbuild`
2. `cargo lambda deploy --binary-name backend class-demo-env-backend`
3. `cargo lambda deploy --binary-name cron class-demo-env-cron`
4. `cargo lambda deploy --binary-name authorizer class-demo-env-authorizer`

---

## 💻 Frontend
Create a `.env.local` file with the output from Terraform.

**Template:**
* `VITE_AWS_REGION=us-east-1`
* `VITE_COGNITO_USER_POOL_ID=us-east-1_abcedf`
* `VITE_COGNITO_CLIENT_ID=abcedf`
* `VITE_WEBSOCKET_URL=wss://abcdef.execute-api.us-east-1.amazonaws.com/production`

**Commands:**
* `npm install`
* `npm run dev`

---

## 📂 Structure
* **omegroup/**: Root directory
  * **infra/**: Terraform (IaC) - Handles VPC, Cognito, DynamoDB, and API Gateway.
  * **backend/**: Rust (Serverless) - Contains the WebSocket hub and Lambda handlers.
  * **ui/**: React (Edge Client) - Vite, Tailwind, and IVS broadcast logic.