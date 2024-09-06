# 0xCalibur Forge Template

## Prerequisites
- Foundry
- Bun
- Linux / MacOS / WSL 2

## Commit Style
`<emoji><space><Title>`

| Type             | Emoji |
|------------------|-------|
| readme/docs      | 📝 |
| new feature      | ✨ |
| refactor/cleanup | ♻️ |
| nit              | 🥢 |
| security fix     | 🔒 |
| optimization     | ⚡️ |
| configuration    | 👷‍♂️ |
| events           | 🔊 |
| bug fix          | 🐞 |
| tooling          | 🔧 |
| deployments      | 🚀 |

## Getting Started
Initialize
```sh
bun install
```

Make a copy of `.env.defaults` to `.env` and set the desired parameters. This file is git ignored.

Build and Test.

```sh
bun run build
bun run test
```

Test a specific file
```sh
bun run test --match-path test/MyTest.t.sol
```

Test a specific test
```sh
bun run test --match-path test/MyTest.t.sol --match-test testFoobar
```

## Deploy & Verify
This will run each deploy the script `MyScript.s.sol` inside `script/` folder.
```sh
bun run deploy --network <network-name> --script <my-script-name>
```

## Dependencies
use `libs.json` to specify the git dependency lib with the commit hash.
run `bun install` again to update them.

## Updating Foundry
This will update to the latest Foundry release
```
foundryup
```

## Playground
Playground is a place to make quick tests. Everything that could be inside a normal test can be used there.
Use case can be to test out some gas optimisation, decoding some data, play around with solidity, etc.

```
bun run playground
```