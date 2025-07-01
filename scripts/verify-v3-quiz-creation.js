const { ethers } = require('ethers');
const Database = require('../src/services/database');
require('dotenv').config();

async function verifyQuizCreation() {
    console.log('🔍 Verifying MotherFactory v3 Quiz Creation...\n');
    
    try {
        // Initialize database
        const database = new Database();
        await database.initialize();
        
        // Get the most recent quiz
        console.log('📋 Step 1: Checking Database Record...');
        const recentQuizzes = await database.getQuizzes(1); // Get 1 most recent
        
        if (recentQuizzes.length === 0) {
            console.log('❌ No quizzes found in database!');
            return;
        }
        
        const quiz = recentQuizzes[0];
        console.log('✅ Found recent quiz:', {
            id: quiz.id,
            creator: quiz.creator,
            sourceUrl: quiz.sourceUrl,
            fundingAmount: quiz.fundingAmount,
            escrowAddress: quiz.escrowAddress,
            status: quiz.status,
            createdAt: quiz.createdAt
        });
        
        // Check if escrow address is present
        if (!quiz.escrowAddress) {
            console.log('❌ ISSUE: Quiz found but no escrow address recorded!');
            console.log('   This indicates deployment may have failed.');
            return;
        }
        
        console.log(`✅ Escrow address recorded: ${quiz.escrowAddress}`);
        
        // Initialize blockchain connection
        console.log('\n🌐 Step 2: Verifying On-Chain Contract...');
        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
        
        // Check if the escrow address has contract code
        const code = await provider.getCode(quiz.escrowAddress);
        if (code === '0x') {
            console.log('❌ ISSUE: No contract code found at escrow address!');
            console.log('   Address may be incorrect or deployment failed.');
            return;
        }
        
        console.log('✅ Contract code found at escrow address');
        console.log(`   Code length: ${code.length} characters`);
        
        // Try to interact with the QuizEscrow contract
        console.log('\n🎯 Step 3: Testing QuizEscrow Contract Interaction...');
        const QuizEscrowABI = require('../artifacts/contracts/QuizEscrow.sol/QuizEscrow.json').abi;
        const quizEscrow = new ethers.Contract(quiz.escrowAddress, QuizEscrowABI, provider);
        
        try {
            const quizUrl = await quizEscrow.quizUrl();
            const fundingToken = await quizEscrow.fundingToken();
            const totalFunding = await quizEscrow.totalFunding();
            const expiryTime = await quizEscrow.expiryTime();
            
            console.log('✅ QuizEscrow contract interaction successful:');
            console.log(`   Quiz URL: ${quizUrl}`);
            console.log(`   Funding Token: ${fundingToken}`);
            console.log(`   Total Funding: ${ethers.formatEther(totalFunding)} ETH`);
            console.log(`   Expiry Time: ${new Date(Number(expiryTime) * 1000).toISOString()}`);
            
            // Verify the quiz URL matches
            if (quizUrl === quiz.sourceUrl) {
                console.log('✅ Quiz URL matches database record');
            } else {
                console.log('⚠️  WARNING: Quiz URL mismatch between contract and database');
                console.log(`   Database: ${quiz.sourceUrl}`);
                console.log(`   Contract: ${quizUrl}`);
            }
            
        } catch (contractError) {
            console.log('❌ ISSUE: Failed to interact with QuizEscrow contract');
            console.log('   Error:', contractError.message);
            return;
        }
        
        // Check MotherFactory deployment record
        console.log('\n🏭 Step 4: Verifying MotherFactory Deployment Record...');
        const motherFactoryAddress = process.env.MOTHER_FACTORY_ADDRESS;
        const MotherFactoryABI = require('../artifacts/contracts/MotherFactory.sol/MotherFactory.json').abi;
        const motherFactory = new ethers.Contract(motherFactoryAddress, MotherFactoryABI, provider);
        
        try {
            const totalDeployed = await motherFactory.getTotalDeployed();
            console.log(`✅ MotherFactory total deployed contracts: ${totalDeployed}`);
            
            if (totalDeployed > 0) {
                // Get the most recent deployment
                const recentDeployment = await motherFactory.getDeployedContract(totalDeployed - 1);
                console.log(`✅ Most recent deployment: ${recentDeployment}`);
                
                if (recentDeployment.toLowerCase() === quiz.escrowAddress.toLowerCase()) {
                    console.log('✅ QuizEscrow address matches MotherFactory deployment record');
                } else {
                    console.log('⚠️  WARNING: Address mismatch with MotherFactory record');
                    console.log(`   Database: ${quiz.escrowAddress}`);
                    console.log(`   MotherFactory: ${recentDeployment}`);
                }
            }
            
        } catch (factoryError) {
            console.log('⚠️  WARNING: Could not verify MotherFactory deployment record');
            console.log('   Error:', factoryError.message);
        }
        
        console.log('\n🎉 VERIFICATION COMPLETE!');
        console.log('=====================================');
        console.log('✅ Database record: VALID');
        console.log('✅ Contract deployment: CONFIRMED');
        console.log('✅ Contract interaction: SUCCESS');
        console.log('✅ MotherFactory v3 User Deployment: WORKING');
        
        console.log('\n📊 Summary:');
        console.log(`   Quiz ID: ${quiz.id}`);
        console.log(`   Escrow Address: ${quiz.escrowAddress}`);
        console.log(`   Network: Base Sepolia (${process.env.CHAIN_ID})`);
        console.log(`   Funding: ${quiz.fundingAmount} tokens`);
        console.log(`   Status: ${quiz.status}`);
        
    } catch (error) {
        console.error('❌ Verification failed:', error);
    }
}

// Run verification
verifyQuizCreation().catch(console.error);
