# MotherFactory Deployment History - Base Sepolia
**Date**: June 23, 2025  
**Network**: Base Sepolia Testnet (Chain ID: 84532)  
**Status**: ✅ v2 Successfully Deployed with Bot-Only Restriction

## 🎯 Overview
Complete deployment of the MotherFactory system on Base Sepolia testnet with **bot-only deployment restriction**, ensuring only the Discord bot can deploy QuizEscrow contracts via the MotherFactory, eliminating edge cases and ensuring perfect coordination.

---

## 🆕 **V2 DEPLOYMENT (Bot-Only Restriction) - CURRENT**

### 📋 Contract Addresses (v2)

#### Main Contracts (For Bot Integration)
- **MotherFactory (Proxy)**: `0xFC94d8b4CB7a73Cd4E6b3dE152df26066f6Ae9E0`
- **QuizHandler (Proxy)**: `0xb9cb3C68a561F5EFC12FBc610aaED1df2672d903`
- **Discord Bot Wallet**: `0xDa04681DF85A8231b967E6cDeFC332fcabeEB0ee`
- **Deployment Wallet**: `0x669ae74656b538c9a96205f8f4073d258eb4c85f`

#### Supporting Infrastructure
- **MotherFactory Logic**: `0x515a4b31F863c06c4AD397022ec5832Ba50184Db`
- **QuizHandler Logic**: `0x232Df86809E7e5372DF1fCFdE4F6d36889A1d8f0`
- **ProxyAdmin**: `0xe36d7889b107723505E687eFEc24e3AE505021f6`

### 🔒 **V2 Security Model**
- **Bot-Only Deployment**: Only Discord bot (`0xDa04681DF85A8231b967E6cDeFC332fcabeEB0ee`) can deploy QuizEscrow contracts
- **Access Control**: MotherFactory enforces `onlyAuthorizedBot` modifier on `deployContract()`
- **Edge Case Elimination**: No orphaned contracts possible - perfect bot/contract coordination
- **Result Recording**: Each QuizEscrow has Discord bot as authorized result recorder
- **Fund Protection**: 24-hour expiry for automatic fund recovery if bot never interacts

### 🔧 **V2 Technical Implementation**

#### New Features Added
- **`authorizedBot` State Variable**: Stores Discord bot wallet address
- **`onlyAuthorizedBot` Modifier**: Restricts deployment function to bot only
- **`initialize(address _authorizedBot)`**: Sets authorized bot during proxy init
- **`setAuthorizedBot(address newBot)`**: Owner-only function to update bot address

#### Architecture (Enhanced)
- **Upgradeable Proxy Pattern**: Uses OpenZeppelin's TransparentUpgradeableProxy
- **Factory Pattern**: MotherFactory manages deployment handlers with bot restriction
- **Strict Access Control**: Only Discord bot can deploy, but anyone can interact with deployed contracts
- **Handler Registration**: QuizHandler registered with MotherFactory for QuizEscrow deployments

### 💰 **V2 Deployment Costs**
- **Total Gas Used**: ~0.0053 ETH
- **Network**: Base Sepolia (free testnet ETH)
- **Deployment Method**: Full redeployment (not upgrade)

### 📁 **V2 Configuration Files**
- **Deployment Details**: `contracts/base-sepolia-deployment-v2.json`
- **Address Registry**: `contracts/deployed-addresses-v2.json`
- **V1 Backup**: `contracts/base-sepolia-deployment-v1-backup.json`
- **Environment Setup**: Uses `DEPLOYMENT_PK` from `.env`

### 🧪 **V2 Testing Results**
- **Verification Tests**: ✅ 7/7 tests passed
- **Bot Authorization**: ✅ Verified in both MotherFactory and QuizHandler
- **Bot-Only Restriction**: ✅ Verified - non-bot deployments properly rejected
- **Handler Registration**: ✅ Confirmed successful
- **Contract State**: ✅ All initialization verified

### 🚀 **V2 Integration Ready**

#### Bot Configuration (Current)
```javascript
MOTHER_FACTORY_ADDRESS=0xFC94d8b4CB7a73Cd4E6b3dE152df26066f6Ae9E0
QUIZ_HANDLER_ADDRESS=0xb9cb3C68a561F5EFC12FBc610aaED1df2672d903
DISCORD_BOT_WALLET=0xDa04681DF85A8231b967E6cDeFC332fcabeEB0ee
CHAIN_ID=84532
```

#### Deployment Command Used (v2)
```bash
npx hardhat run contracts/scripts/deploy-v2-base-sepolia.js --network baseSepolia
```

#### Verification Command (v2)
```bash
npx hardhat run contracts/scripts/test-base-sepolia-deployment.js --network baseSepolia
```

---

## 📜 **V1 DEPLOYMENT (Legacy) - DEPRECATED**

### Contract Addresses (v1 - DEPRECATED)
- **MotherFactory (Proxy)**: `0xb5422FBA026113bfB41f8cf3d9dd140FCDccC266`
- **QuizHandler (Proxy)**: `0x0F626f912BB4a38e3b48a6B6560E2E4A75a25b88`
- **Authorized Bot Wallet**: `0x669ae74656B538c9a96205f8f4073d258EB4C85F` ⚠️ (Was deployer wallet)

### V1 Issues (Fixed in v2)
- ❌ **Any wallet could deploy**: No bot-only restriction
- ❌ **Wrong bot wallet**: Used deployer wallet instead of Discord bot
- ❌ **Edge cases possible**: Orphaned contracts could be created

### V1 Technical Fixes Applied
1. **QuizHandler Constructor Pattern**: Updated to use Initializable pattern
2. **ProxyAdmin Initialization**: Added deployer address as initial owner  
3. **MotherFactory Initialization**: Corrected to use empty parameter array

---

## 🔗 **Verification & Explorer Links**

### V2 (Current)
- **MotherFactory**: https://sepolia.basescan.org/address/0xFC94d8b4CB7a73Cd4E6b3dE152df26066f6Ae9E0
- **QuizHandler**: https://sepolia.basescan.org/address/0xb9cb3C68a561F5EFC12FBc610aaED1df2672d903
- **ProxyAdmin**: https://sepolia.basescan.org/address/0xe36d7889b107723505E687eFEc24e3AE505021f6

### V1 (Legacy)
- **MotherFactory**: https://sepolia.basescan.org/address/0xb5422FBA026113bfB41f8cf3d9dd140FCDccC266
- **QuizHandler**: https://sepolia.basescan.org/address/0x0F626f912BB4a38e3b48a6B6560E2E4A75a25b88

## 📊 **Final Testing Status**
- **Local Testing**: ✅ Complete (79+ unit tests passing)
- **Simulation Testing**: ✅ Complete (QuizLifecycleSimulator validated)
- **Base Sepolia V2 Testing**: ✅ Complete (7/7 verification tests passed)
- **Bot Integration**: ✅ Ready (contracts deployed with correct authorization)

### 🎯 **Next Steps**
1. **Update bot .env** with v2 contract addresses
2. **Test QuizEscrow deployment** via v2 MotherFactory (bot-only)
3. **Run end-to-end quiz lifecycle** on Base Sepolia with Discord bot
4. **Verify Collab.Land Account Kit integration** works with v2 contracts
5. **Production deployment** ready after v2 validation
