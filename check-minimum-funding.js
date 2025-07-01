const ethers = require('ethers');

async function checkMinimumFunding() {
  try {
    // Connect to Base Sepolia
    const provider = new ethers.providers.JsonRpcProvider('https://sepolia.base.org');
    
    // QuizHandler address from deployment records
    const quizHandlerAddress = '0xb9cb3C68a561F5EFC12FBc610aaED1df2672d903';
    
    // QuizHandler ABI (extended for funding checks)
    const abi = [
      'function DEPLOYMENT_FEE() external view returns (uint256)',
      'function MINIMUM_FUNDING_AMOUNT() external view returns (uint256)',
      'function MIN_REWARD_AMOUNT() external view returns (uint256)',
      'function calculateTotalRequired(uint256 correctReward, uint256 incorrectReward) external view returns (uint256)'
    ];
    
    const contract = new ethers.Contract(quizHandlerAddress, abi, provider);
    
    console.log('=== FUNDING REQUIREMENTS ANALYSIS ===');
    
    // Check deployment fee
    try {
      const deploymentFee = await contract.DEPLOYMENT_FEE();
      console.log('✅ Deployment fee (ETH):', ethers.utils.formatEther(deploymentFee));
    } catch (error) {
      console.log('❌ Could not get deployment fee:', error.message);
    }
    
    // Check minimum funding
    try {
      const minFunding = await contract.MINIMUM_FUNDING_AMOUNT();
      console.log('✅ Minimum funding (ETH):', ethers.utils.formatEther(minFunding));
    } catch (error) {
      console.log('❌ No MINIMUM_FUNDING_AMOUNT function');
    }
    
    // Check minimum reward
    try {
      const minReward = await contract.MIN_REWARD_AMOUNT();
      console.log('✅ Minimum reward (ETH):', ethers.utils.formatEther(minReward));
    } catch (error) {
      console.log('❌ No MIN_REWARD_AMOUNT function');
    }
    
    // Check total calculation
    try {
      const totalRequired = await contract.calculateTotalRequired(0, 0);
      console.log('✅ Total required for 0/0 rewards (ETH):', ethers.utils.formatEther(totalRequired));
    } catch (error) {
      console.log('❌ No calculateTotalRequired function');
    }
    
    console.log('');
    console.log('=== ZERO FUNDING TEST ===');
    console.log('Current quiz parameters:');
    console.log('- correctReward: 0 ETH');
    console.log('- incorrectReward: 0 ETH'); 
    console.log('- Total funding: 0 ETH');
    console.log('- Deployment fee: 0.001 ETH');
    console.log('- Total sent: 0.001 ETH');
    console.log('');
    console.log('Contract error: "Insufficient payment for deployment fee and funding"');
    console.log('This suggests the contract requires funding > 0 or has a minimum funding requirement.');
    
  } catch (error) {
    console.error('Error checking funding requirements:', error.message);
  }
}

checkMinimumFunding();
