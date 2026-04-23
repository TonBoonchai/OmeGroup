# OmeGroup
Random Group Video Chat Platform


# draft
## backend
not tested
```
cargo install cargo-lambda
cargo lambda build --release --bin authorizer --arm64
cargo lambda deploy class-demo-env-backend
```
## frontend
not tested
```
npm create vite@latest ui -- --template react-ts
cd ui
npm install amazon-ivs-web-broadcast react-use-websocket lucide-react
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install aws-amplify @aws-amplify/ui-react
npm run dev
```
## structure
```
omegroup/                              # Your root project directory
│
├── infra/                             # ☁️ Phase 1: Terraform (Infrastructure as Code)
│   ├── .gitignore                     # Ignores sensitive .tfvars and local state
│   ├── variables.tf                   # Defines region, CIDR blocks, hardware specs
│   ├── terraform.tfvars               # The actual values (DO NOT COMMIT)
│   ├── main.tf                        # The VPC, Private/Public Subnets, NAT Gateway, Redis
│   ├── auth.tf                        # AWS Cognito User Pool and App Client
│   ├── database.tf                    # Amazon DynamoDB Table
│   └── compute.tf                     # API Gateway, IAM Roles, and the 3 Lambda definitions
│
├── backend/                           # ⚙️ Phase 2: Rust (The Serverless Brain)
│   ├── Cargo.toml                     # Dependencies (lambda_http, aws-sdk-ivs, redis, etc.)
│   └── src/
│       ├── main.rs                    # The main WebSocket Hub ($connect, $disconnect, swipe, send_message)
│       └── bin/
│           ├── authorizer.rs          # The Edge Bouncer (Decodes Cognito JWTs before API Gateway)
│           └── cron.rs                # The EventBridge Heartbeat (Loops 12x per min, generates IVS tokens)
│
└── ui/                                # 🖥️ Phase 3: React (The Edge Client)
    ├── package.json                   # Vite, Tailwind, amazon-ivs-web-broadcast, aws-amplify
    ├── tailwind.config.js             # UI styling constraints
    └── src/
        ├── index.css                  # Tailwind directives and dark mode body constraints
        ├── App.tsx                    # Cognito <Authenticator> wrapper and main Layout
        ├── components/
        │   └── VideoGrid.tsx          # Raw DOM hardware binding and dynamic grid math
        └── hooks/
            └── useMatchmaker.ts       # WebSocket state machine, chat arrays, and payload handling

```