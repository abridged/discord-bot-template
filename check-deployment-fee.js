const ethers = require('ethers');

async function checkDeploymentFee() {
  try {
    // Connect to Base Sepolia
    const provider = new ethers.providers.JsonRpcProvider('https://sepolia.base.org');
    
    // QuizHandler address from deployment records (properly checksummed)
    const quizHandlerAddress = '0xb9cb3C68a561F5EFC12FBc610aaED1df2672d903';
    
    // QuizHandler ABI (minimal, just for DEPLOYMENT_FEE)
    const abi = ['function DEPLOYMENT_FEE() external view returns (uint256)'];
    
    const contract = new ethers.Contract(quizHandlerAddress, abi, provider);
    const actualFee = await contract.DEPLOYMENT_FEE();
    
    console.log('=== DEPLOYMENT FEE ANALYSIS ===');
    console.log('Actual contract deployment fee (wei):', actualFee.toString());
    console.log('Actual contract deployment fee (ETH):', ethers.utils.formatEther(actualFee));
    console.log('Actual contract deployment fee (hex):', actualFee.toHexString());
    console.log('');
    console.log('Hardcoded fee in code (ETH): 0.001');
    console.log('Hardcoded fee in code (wei):', ethers.utils.parseEther('0.001').toString());
    console.log('Hardcoded fee in code (hex):', ethers.utils.parseEther('0.001').toHexString());
    console.log('');
    console.log('Are they equal?', actualFee.eq(ethers.utils.parseEther('0.001')));
    
    if (!actualFee.eq(ethers.utils.parseEther('0.001'))) {
      console.log('🚨 MISMATCH DETECTED: Contract fee differs from hardcoded fee!');
      if (actualFee.gt(ethers.utils.parseEther('0.001'))) {
        const ratio = actualFee.div(ethers.utils.parseEther('0.001'));
        console.log('Contract fee is', ratio.toString(), 'x LARGER than hardcoded fee');
      } else {
        const ratio = ethers.utils.parseEther('0.001').div(actualFee);
        console.log('Contract fee is', ratio.toString(), 'x SMALLER than hardcoded fee');
      }
    } else {
      console.log('✅ Contract fee matches hardcoded fee');
    }
    
    console.log('=== TRANSACTION VALUE ANALYSIS ===');
    console.log('Value sent in transaction (from error): 0x38d7ea4c68000');
    const sentValue = ethers.BigNumber.from('0x38d7ea4c68000');
    console.log('Value sent in wei:', sentValue.toString());
    console.log('Value sent in ETH:', ethers.utils.formatEther(sentValue));
    console.log('Does sent value match contract fee?', sentValue.eq(actualFee));
    
  } catch (error) {
    console.error('Error checking deployment fee:', error.message);
  }
}

checkDeploymentFee();
