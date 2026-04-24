# OmeGroup
Random Group Video Chat Platform


# draft



## backend
must deploy terraform first
then use url from finish terrform to inject to backend
then compile then upload to lambda
```
cargo install cargo-lambda
cargo lambda build --release --compiler cargo-zigbuild
cargo lambda deploy omegroup-backend
```
## frontend
```
npm install
npm run dev
```
## structure
```
omegroup/                              # Your root project directory
│
├── infra/                             # Terraform (Infrastructure as Code)
│   ├── .gitignore                     # Ignores sensitive .tfvars and local state
│   ├── variables.tf                   # Defines region, CIDR blocks, hardware specs
│   ├── terraform.tfvars               # The actual values (DO NOT COMMIT)
│   ├── main.tf                        # The VPC, Private/Public Subnets, NAT Gateway, Redis
│   ├── auth.tf                        # AWS Cognito User Pool and App Client
│   ├── database.tf                    # Amazon DynamoDB Table
│   └── compute.tf                     # API Gateway, IAM Roles, and the 3 Lambda definitions
│
├── backend/                           # Rust (The Serverless Brain)
│   ├── Cargo.toml                     
│   └── src/
│       ├── main.rs                    # The main WebSocket Hub ($connect, $disconnect, swipe, send_message)
│       └── handlers.rs
│       └── bin/
│           ├── authorizer.rs          # The Edge Bouncer (Decodes Cognito JWTs before API Gateway)
│           └── cron.rs                # The EventBridge Heartbeat (Loops 12x per min, generates IVS tokens)
│
└── ui/                                # React (The Edge Client)
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