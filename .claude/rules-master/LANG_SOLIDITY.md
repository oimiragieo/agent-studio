---
description: Solidity smart contract development - Foundry, Hardhat, and Xian
globs: **/*.sol, contracts/**/*.sol, test/**/*.sol, scripts/**/*.sol
priority: high
---

# Solidity Smart Contract Master Rules

**Consolidated from**: solidity-foundry, solidity-hardhat, xian-smart-contracts.

## Solidity Version

- Use **Solidity 0.8.20+** (latest stable)
- Use explicit version pragma: `pragma solidity ^0.8.20;`
- Consider upgradeable contracts when needed

## Development Frameworks

### Foundry (Preferred for New Projects)

- Use **Foundry** for testing and deployment
- Use `forge` for building and testing
- Use `cast` for interacting with contracts
- Use `anvil` for local development
- Leverage fuzzing and invariant testing

### Hardhat (Alternative)

- Use **Hardhat** for projects requiring extensive plugins
- Use Hardhat's testing framework
- Use Hardhat's deployment scripts
- Leverage Hardhat's debugging tools

### Xian (Python Smart Contracts)

- Use **Xian** for Python-native smart contracts
- Write contracts in pure Python (no transpilation)
- Use Xian's event-driven architecture
- Leverage Python's rich ecosystem

## Security Best Practices

### Critical Security Patterns

1. **Checks-Effects-Interactions Pattern**: Always follow CEI
   - Checks: Validate conditions
   - Effects: Update state
   - Interactions: External calls

2. **Reentrancy Protection**: Use `nonReentrant` modifier or checks
3. **Access Control**: Use OpenZeppelin's AccessControl
4. **Integer Overflow**: Solidity 0.8+ handles automatically
5. **Unchecked External Calls**: Always validate return values

### Example

```solidity
// BAD - Vulnerable to reentrancy
function withdraw() external {
    uint256 amount = balances[msg.sender];
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success, "Transfer failed");
    balances[msg.sender] = 0;
}

// GOOD - Protected against reentrancy
function withdraw() external nonReentrant {
    uint256 amount = balances[msg.sender];
    balances[msg.sender] = 0; // Effects first
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success, "Transfer failed");
}
```

## Code Style

### Function Visibility

- Use explicit visibility modifiers: `public`, `private`, `internal`, `external`
- Prefer `external` for functions only called externally
- Use `internal` for functions called by derived contracts
- Use `private` for internal-only functions

### Naming Conventions

- Use `PascalCase` for contracts and structs
- Use `camelCase` for functions and variables
- Use `UPPER_CASE` for constants
- Use descriptive names
- Prefix private variables with underscore: `_privateVar`

### Example

```solidity
contract TokenContract {
    string public constant TOKEN_NAME = "MyToken";
    uint256 private _totalSupply;
    mapping(address => uint256) public balances;

    function transfer(address to, uint256 amount) external returns (bool) {
        // Implementation
    }
}
```

## Gas Optimization

### Best Practices

- Use `uint256` instead of smaller uints (unless packing)
- Use `bytes32` instead of `string` when possible
- Pack structs efficiently
- Use events instead of storage for historical data
- Use custom errors instead of revert strings
- Cache storage variables in memory
- Use `unchecked` blocks for safe arithmetic

### Example

```solidity
// BAD - Expensive
function getValue() external view returns (uint256) {
    return storageValue + storageValue2; // Two SLOADs
}

// GOOD - Cached
function getValue() external view returns (uint256) {
    uint256 val1 = storageValue; // One SLOAD
    uint256 val2 = storageValue2; // One SLOAD
    return val1 + val2;
}
```

## Events

### Event Best Practices

- Emit events for all state changes
- Use indexed parameters (max 3) for filtering
- Include relevant data in events
- Use descriptive event names

### Example

```solidity
event Transfer(address indexed from, address indexed to, uint256 value);
event Approval(address indexed owner, address indexed spender, uint256 value);

function transfer(address to, uint256 amount) external returns (bool) {
    balances[msg.sender] -= amount;
    balances[to] += amount;
    emit Transfer(msg.sender, to, amount);
    return true;
}
```

## Testing

### Foundry Testing

- Use Foundry's testing framework
- Leverage fuzzing with `forge test --fuzz`
- Use invariant testing
- Use cheatcodes for testing scenarios
- Test all edge cases

### Example (Foundry)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {MyContract} from "../src/MyContract.sol";

contract MyContractTest is Test {
    MyContract public contract;

    function setUp() public {
        contract = new MyContract();
    }

    function testTransfer(uint256 amount) public {
        // Fuzz test
        vm.assume(amount > 0 && amount <= 1000);
        contract.transfer(address(1), amount);
        assertEq(contract.balanceOf(address(1)), amount);
    }
}
```

### Hardhat Testing

- Use Hardhat's testing framework
- Use fixtures for setup
- Mock external contracts
- Test error scenarios

## OpenZeppelin Integration

### Common Contracts

- Use `Ownable` for ownership
- Use `AccessControl` for role-based access
- Use `ReentrancyGuard` for reentrancy protection
- Use `Pausable` for emergency stops
- Use `ERC20`, `ERC721`, `ERC1155` for tokens

### Example

```solidity
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract MyContract is Ownable, ReentrancyGuard {
    function withdraw() external onlyOwner nonReentrant {
        // Implementation
    }
}
```

## Upgradeable Contracts

### Patterns

- Use **UUPS** (Universal Upgradeable Proxy Standard) for upgrades
- Use **Transparent Proxy** pattern when needed
- Use **Beacon Proxy** for multiple instances
- Always test upgrade paths
- Validate storage layout compatibility

## Documentation

### NatSpec Comments

- Use NatSpec format for documentation
- Document all public functions
- Document state variables
- Include parameter descriptions
- Include return value descriptions

### Example

```solidity
/// @title A simple token contract
/// @author Your Name
/// @notice This contract implements a basic ERC20 token
contract Token {
    /// @notice Transfers tokens to an address
    /// @param to The address to transfer to
    /// @param amount The amount to transfer
    /// @return success Whether the transfer was successful
    function transfer(address to, uint256 amount) external returns (bool success) {
        // Implementation
    }
}
```

## Xian (Python Smart Contracts)

### Xian-Specific Patterns

- Write contracts in pure Python
- Use Xian's event system
- Use Variables and Hashes for state
- Follow Xian's testing patterns
- Use Xian's standard library

### Example (Xian)

```python
from contracting.client import ContractingClient

def transfer(amount: int, to: str):
    """Transfer tokens to another address."""
    sender = ctx.caller
    balance = Variable.get(sender, 0)

    assert balance >= amount, "Insufficient balance"

    Variable.set(sender, balance - amount)
    Variable.set(to, Variable.get(to, 0) + amount)

    ctx.emit('Transfer', sender=sender, to=to, amount=amount)
```

## Migration Notes

This master file consolidates rules from:

- `solidity-foundry-cursorrules-prompt-file`
- `solidity-hardhat-cursorrules-prompt-file`
- `xian-smart-contracts-cursor-rules-prompt-file`

**Old rule files can be archived** - this master file is the single source of truth for Solidity smart contract development.
