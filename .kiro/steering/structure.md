# Project Structure

## Current Layout

```
environment/
├── .git/                  # Git version control
├── .kiro/
│   └── steering/          # Kiro AI steering rules
│       ├── product.md
│       ├── tech.md
│       └── structure.md
└── .gitignore
```

## Expected Conventions

Once source code is added, follow these general Node.js project conventions:

```
environment/
├── src/                   # Application source code
├── tests/                 # Test files, mirroring src/ structure
├── public/                # Static assets (if applicable)
├── dist/                  # Build output (not committed)
├── node_modules/          # Dependencies (not committed)
├── package.json           # Project manifest and scripts
└── README.md              # Project documentation
```

## Rules

- Do not commit `node_modules/` or build output directories
- Keep test files co-located with source or in a top-level `tests/` directory — be consistent
- Update this file when the actual folder structure is established
