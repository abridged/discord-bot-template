require('dotenv').config();
const QuizService = require('../src/services/blockchain/quizService');
const RealBlockchainService = require('../src/services/blockchain/realBlockchainService');

async function debugDeployment() {
    console.log('🔧 Debugging MotherFactory v3 Deployment Flow...\n');
    
    // Test data matching the failed quiz
    const testQuizData = {
        id: '9f428f2f-3d94-4d70-b2bc-6a086adc02e7',
        sourceUrl: 'https://ethereum-magicians.org/t/erc-7806-intent-smart-account-for-eip-7702/21565',
        rewardAmount: 10,
        tokenAddress: '0xb1E9C41e4153F455A30e66A2DA37D515C81a16D1',
        chainId: 84532,
        creatorWalletAddress: '0x4917e853DC273da5F84362aB9f13eE49775B263c'
    };
    
    console.log('📋 Test Quiz Data:', testQuizData);
    
    try {
        // Step 1: Test QuizService initialization
        console.log('\n🔧 Step 1: Testing QuizService Initialization...');
        const quizService = new QuizService();
        console.log('✅ QuizService created');
        console.log(`   Contracts Available: ${quizService.contractsAvailable}`);
        console.log(`   Chain ID: ${quizService.chainId}`);
        console.log(`   MotherFactory: ${quizService.motherFactoryAddress}`);
        console.log(`   QuizHandler: ${quizService.quizHandlerAddress}`);
        
        // Step 2: Test user wallet validation
        console.log('\n👤 Step 2: Testing User Wallet...');
        const userWallet = testQuizData.creatorWalletAddress;
        console.log(`   User Wallet: ${userWallet}`);
        
        // Step 3: Test direct deployment call
        console.log('\n🚀 Step 3: Testing Direct QuizEscrow Deployment...');
        console.log('   Calling QuizService.deployQuizEscrow...');
        
        const deploymentResult = await quizService.deployQuizEscrow(
            testQuizData.sourceUrl,
            testQuizData.rewardAmount,
            testQuizData.tokenAddress,
            userWallet
        );
        
        console.log('📊 Deployment Result:', deploymentResult);
        
        if (deploymentResult) {
            console.log('✅ Deployment call completed');
            console.log(`   Transaction Hash: ${deploymentResult.transactionHash || 'MISSING'}`);
            console.log(`   Escrow Address: ${deploymentResult.escrowAddress || 'MISSING'}`);
            console.log(`   Status: ${deploymentResult.status || 'UNKNOWN'}`);
        } else {
            console.log('❌ Deployment returned null/undefined');
        }
        
    } catch (error) {
        console.error('❌ Deployment test failed:', error);
        console.error('   Error type:', error.constructor.name);
        console.error('   Error message:', error.message);
        if (error.stack) {
            console.error('   Stack trace:', error.stack);
        }
    }
    
    try {
        // Step 4: Test RealBlockchainService flow
        console.log('\n🌐 Step 4: Testing RealBlockchainService Flow...');
        const blockchainService = new RealBlockchainService();
        
        console.log('   Testing submitQuiz...');
        
        // Add the missing Discord ID to test data for proper v3 testing
        const testQuizDataWithDiscordId = {
            ...testQuizData,
            creatorDiscordId: '326397724675276802' // Add Discord ID that exists in our test database
        };
        
        // Call submitQuiz with all required parameters: (quizData, userWallet, discordUserId)
        const submitResult = await blockchainService.submitQuiz(
            testQuizDataWithDiscordId, 
            testQuizData.creatorWalletAddress, // Use the wallet address from test data
            '326397724675276802' // Discord user ID for Account Kit
        );
        
        console.log('📊 Submit Result:', submitResult);
        
        if (submitResult) {
            console.log('✅ SubmitQuiz call completed');
            console.log(`   Status: ${submitResult.status || 'UNKNOWN'}`);
            console.log(`   Transaction Hash: ${submitResult.transactionHash || 'MISSING'}`);
            console.log(`   Escrow Address: ${submitResult.escrowAddress || 'MISSING'}`);
            console.log(`   Reason: ${submitResult.reason || 'None'}`);
        } else {
            console.log('❌ SubmitQuiz returned null/undefined');
        }
        
    } catch (error) {
        console.error('❌ RealBlockchainService test failed:', error);
        console.error('   Error type:', error.constructor.name);
        console.error('   Error message:', error.message);
    }
    
    console.log('\n🔧 DEBUG COMPLETE');
    console.log('=====================================');
}

// Run debug
debugDeployment().catch(error => {
    console.error('Debug script failed:', error);
    process.exit(1);
});
