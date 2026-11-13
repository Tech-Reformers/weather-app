# Requirements Document

## Introduction

Deploy the existing weather app to AWS as a public static website. The deployment follows the target architecture from the AWS architecture review: a private Amazon S3 bucket served only through Amazon CloudFront using Origin Access Control (OAC), with HTTPS and browser security headers applied at CloudFront. All AWS resources are defined in one AWS CloudFormation template so the stack can be created, updated, and deleted repeatably.

The deployment is run from a Jupyter notebook that doubles as a classroom demo: students watch each step, read why it is done, and can repeat it on their own.

The browser continues to call Nominatim and the National Weather Service (NWS) API directly. No backend compute (Lambda, API Gateway, containers, EC2) is added.

### Scope decisions

- **In scope:** the CloudFormation template, the deployment notebook (deploy and cleanup), and README deployment instructions.
- **Out of scope:** application code changes, including the fixes from the architecture review (DOM injection, request cancellation, empty daytime periods) and the stylesheet move below. They are handled separately.
- **Out of scope for now:** custom domain name, ACM certificate, Route 53, AWS WAF, CI/CD pipeline, access logging, and alarms. The site uses the CloudFront default domain (`https://<id>.cloudfront.net`).
- **AWS access:** the notebook uses whatever AWS profile is active in the terminal that started Jupyter (`AWS_PROFILE`). No profile, region, or account ID is hard-coded.

### Prerequisite

Before the first deployment, the app's inline CSS must be moved out of `index.html` into a `styles.css` file loaded with `<link rel="stylesheet">`, with no `<style>` block or inline `style` attributes left in the page. The Content-Security-Policy in Requirement 4 blocks inline styles, so deploying without this change produces an unstyled page and fails Requirement 4.3. This change is made outside this spec.

## Glossary

- **Stack**: The CloudFormation stack that holds every AWS resource for this deployment.
- **Site_Bucket**: The private S3 bucket that stores the app files.
- **Distribution**: The CloudFront distribution that serves the app to users.
- **OAC**: CloudFront Origin Access Control, which lets only the Distribution read from the Site_Bucket.
- **Headers_Policy**: The CloudFront response headers policy that adds security headers to every response.
- **Notebook**: The Jupyter notebook (`.ipynb`, Python kernel) that deploys, verifies, and removes the app using `!aws` lines.
- **App_Files**: `index.html`, `styles.css`, and `weather.js`. No other repository files are deployed.
- **Site_URL**: The `https://` address of the Distribution.

---

## Requirements

### Requirement 1: Infrastructure as Code

**User Story:** As a developer, I want every AWS resource defined in one CloudFormation template, so that the deployment is repeatable and reviewable in version control.

#### Acceptance Criteria

1. THE repository SHALL contain one CloudFormation template that defines the Site_Bucket, OAC, Distribution, Site_Bucket policy, and Headers_Policy.
2. THE template SHALL contain no hard-coded AWS account ID, region, or bucket name.
3. THE template SHALL output the Site_Bucket name, the Distribution ID, and the Site_URL.
4. THE template SHALL tag every taggable resource with a `Project` tag whose value identifies the weather app.
5. WHEN the template is validated with `aws cloudformation validate-template`, THE validation SHALL succeed.

---

### Requirement 2: Private Storage

**User Story:** As a site owner, I want the S3 bucket to be private, so that the files can only be reached through CloudFront.

#### Acceptance Criteria

1. THE Site_Bucket SHALL have all four S3 Block Public Access settings enabled.
2. THE Site_Bucket SHALL NOT have S3 static website hosting enabled.
3. THE Site_Bucket policy SHALL allow `s3:GetObject` only to the CloudFront service principal, restricted by `AWS:SourceArn` to this Distribution.
4. THE Site_Bucket SHALL use server-side encryption with S3 managed keys (SSE-S3).
5. THE Site_Bucket SHALL have S3 Versioning enabled so earlier versions of the App_Files can be restored.
6. WHEN a user requests an App_File directly from the S3 bucket URL, THE request SHALL be denied.

---

### Requirement 3: HTTPS Delivery through CloudFront

**User Story:** As a user, I want to open the app over HTTPS, so that the page and its files cannot be read or altered in transit.

#### Acceptance Criteria

1. THE Distribution SHALL use the Site_Bucket as its only origin, accessed through the OAC.
2. THE Distribution SHALL redirect HTTP viewer requests to HTTPS.
3. THE Distribution SHALL serve `index.html` when the root path `/` is requested.
4. THE Distribution SHALL enable compression.
5. WHEN a user opens the Site_URL in a browser, THE app SHALL load, accept a U.S. city name, and display the forecast exactly as it does on `localhost:8080`.

---

### Requirement 4: Security Headers

**User Story:** As a site owner, I want CloudFront to add browser security headers, so that the browser limits what the page can load and how it can be framed.

#### Acceptance Criteria

1. THE Headers_Policy SHALL add `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and a frame-denial header to every response.
2. THE Headers_Policy SHALL add a `Content-Security-Policy` that allows scripts and styles only from the site itself, with no `'unsafe-inline'`, and network connections only to the site itself, `https://nominatim.openstreetmap.org`, and `https://api.weather.gov`.
3. WHEN the app runs at the Site_URL with the Headers_Policy applied, THE browser console SHALL show no Content-Security-Policy violations during a successful lookup.

---

### Requirement 5: Deployment Notebook — Deploy

**User Story:** As an instructor, I want a notebook that deploys the app step by step with explanations, so that students can watch the deployment and repeat it themselves.

#### Acceptance Criteria

1. THE Notebook SHALL use a Python kernel, run AWS commands as `!aws` lines, and explain each step in a markdown cell: what the step does, why, and any new term defined where it first appears.
2. THE Notebook SHALL NOT contain a hard-coded AWS profile, region, or account ID, and SHALL first run `aws sts get-caller-identity` to show which account and role are in use.
3. THE Notebook SHALL read values from the AWS CLI with `--query ... --output text` into Python variables, strip trailing whitespace, and SHALL NOT parse JSON output in Python.
4. THE Notebook SHALL validate the template, then create or update the Stack, and SHALL succeed when the template has no changes.
5. THE Notebook SHALL upload only the App_Files to the Site_Bucket, each with the correct `Content-Type` and with cache headers that make browsers revalidate them.
6. AFTER uploading, THE Notebook SHALL create a CloudFront invalidation for the App_Files and wait for it to complete.
7. THE Notebook SHALL print the Site_URL and show checks that the site returns HTTP 200 with the security headers, and that a direct S3 request is denied.
8. THE Notebook SHALL list each resource created and where it appears in the AWS console (CloudFormation, S3, CloudFront).
9. EVERY deploy cell SHALL be safe to re-run without errors.
10. WHERE a step is slow (for example CloudFront distribution creation), THE Notebook SHALL say so before the step so a silent wait is expected.

---

### Requirement 6: Deployment Notebook — Cleanup

**User Story:** As an instructor, I want cleanup cells in the notebook, so that nothing is left running or billing after a demo.

#### Acceptance Criteria

1. THE Notebook SHALL delete every object version and delete marker in the Site_Bucket, then delete the Stack and wait until deletion completes.
2. WHEN the Stack does not exist, THE cleanup cells SHALL report that there is nothing to delete and continue without error.
3. THE Notebook SHALL end with a cell that clears all outputs, so the saved notebook contains no account ID, ARN, or email address.

---

### Requirement 7: Documentation and Repository Hygiene

**User Story:** As a developer or student, I want deployment instructions in the README, so that I can deploy and remove the app myself.

#### Acceptance Criteria

1. THE README SHALL describe the AWS architecture in a few sentences and list the resources the Stack creates.
2. THE README SHALL tell readers to run `aws sso login --profile <your-profile>`, set `AWS_PROFILE` in the same terminal, check access with `aws sts get-caller-identity`, and start Jupyter from that terminal.
3. THE README SHALL state that CloudFront distribution creation and deletion can take several minutes.
4. THE README SHALL state the expected cost for a low-traffic site and remind readers to run the cleanup cells when finished.
5. THE README file table SHALL list the template and the Notebook.
6. THE `.gitignore` SHALL exclude `.ipynb_checkpoints/`.
