/**
 * @fileoverview Main Quiz Lifecycle Simulation Script
 * 
 * Entry point for running complete quiz lifecycle simulation with Collab.Land Account Kit
 * and Discord bot interactions. This script deploys contracts, simulates user interactions,
 * and verifies the complete workflow.
 */

const { ethers } = require("hardhat");
const { QuizLifecycleSimulator } = require('./simulation/quizLifecycle');

/**
 * Deploy contracts and get contract instances
 */
async function deployContracts() {
  console.log('🚀 Deploying contracts...\n');
  
  const [deployer, authorizedBot, proxyAdmin] = await ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);
  console.log(`Authorized bot: ${authorizedBot.address}`);
  console.log(`Proxy admin: ${proxyAdmin.address}`);
  console.log(`Deployer balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH\n`);

  // Deploy MotherFactory implementation
  const MotherFactory = await ethers.getContractFactory("MotherFactory");
  const motherFactoryImpl = await MotherFactory.deploy();
  await motherFactoryImpl.deployed();
  console.log(`MotherFactory implementation: ${motherFactoryImpl.address}`);

  // Deploy QuizHandler implementation  
  const QuizHandler = await ethers.getContractFactory("QuizHandler");
  const quizHandlerImpl = await QuizHandler.deploy(); 
  await quizHandlerImpl.deployed();
  console.log(`QuizHandler implementation: ${quizHandlerImpl.address}`);

  // Deploy MotherFactory proxy using our custom proxy contract
  const MotherFactoryProxy = await ethers.getContractFactory("MotherFactoryProxy");
  const initializeData = motherFactoryImpl.interface.encodeFunctionData("initialize");
  
  const motherFactoryProxy = await MotherFactoryProxy.deploy(
    motherFactoryImpl.address,
    proxyAdmin.address,
    initializeData
  );
  await motherFactoryProxy.deployed();
  console.log(`MotherFactory proxy: ${motherFactoryProxy.address}`);

  // Deploy QuizHandler proxy  
  const QuizHandlerProxy = await ethers.getContractFactory("QuizHandlerProxy");
  const quizHandlerInitData = quizHandlerImpl.interface.encodeFunctionData(
    "initialize", 
    [authorizedBot.address] 
  );
  
  const quizHandlerProxy = await QuizHandlerProxy.deploy(
    quizHandlerImpl.address,
    proxyAdmin.address, 
    quizHandlerInitData
  );
  await quizHandlerProxy.deployed();
  console.log(`QuizHandler proxy: ${quizHandlerProxy.address}`);

  // Connect to proxies with correct interfaces
  const motherFactory = MotherFactory.attach(motherFactoryProxy.address);
  const quizHandler = QuizHandler.attach(quizHandlerProxy.address);

  // Register QuizHandler with MotherFactory
  console.log('\n📝 Registering QuizHandler...');
  const registerTx = await motherFactory.registerHandler("QuizEscrow", quizHandler.address);
  await registerTx.wait();
  console.log(`✅ QuizHandler registered with MotherFactory`);

  // Verify registration
  const isActive = await motherFactory.isHandlerActive(quizHandler.address);
  console.log(`Handler active status: ${isActive}\n`);

  return {
    motherFactory,
    quizHandler,
    deployer,
    authorizedBot,
    proxyAdmin
  };
}

/**
 * Run simulation scenarios
 */
async function runSimulationScenarios(contracts) {
  console.log('🎭 Running Simulation Scenarios...\n');

  const scenarios = [
    {
      name: 'Happy Path - 5 Users',
      config: {
        numUsers: 5,
        rewardAmount: ethers.utils.parseEther("0.1"),
        correctAnswerReward: ethers.utils.parseEther("0.06"), 
        incorrectAnswerReward: ethers.utils.parseEther("0.04")
      }
    },
    {
      name: 'Scale Test - 10 Users', 
      config: {
        numUsers: 10,
        rewardAmount: ethers.utils.parseEther("0.2"),
        correctAnswerReward: ethers.utils.parseEther("0.15"),
        incorrectAnswerReward: ethers.utils.parseEther("0.05")
      }
    }
  ];

  const results = [];

  for (const scenario of scenarios) {
    console.log(`\n🎯 Starting Scenario: ${scenario.name}`);
    console.log('═'.repeat(50));

    try {
      const simulator = new QuizLifecycleSimulator(contracts, scenario.config);
      const result = await simulator.run();
      
      results.push({
        scenario: scenario.name,
        success: true,
        result,
        duration: result.duration
      });

      console.log(`✅ Scenario "${scenario.name}" completed successfully in ${result.duration}ms\n`);

    } catch (error) {
      console.error(`❌ Scenario "${scenario.name}" failed:`, error.message);
      results.push({
        scenario: scenario.name,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Generate final report
 */
function generateReport(scenarioResults, startTime) {
  const duration = Date.now() - startTime;
  const successful = scenarioResults.filter(r => r.success);
  const failed = scenarioResults.filter(r => !r.success);

  console.log('\n📊 SIMULATION REPORT');
  console.log('═'.repeat(60));
  console.log(`Total Duration: ${duration}ms`);
  console.log(`Scenarios Run: ${scenarioResults.length}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${failed.length}`);
  console.log('');

  if (successful.length > 0) {
    console.log('✅ SUCCESSFUL SCENARIOS:');
    successful.forEach(result => {
      console.log(`  • ${result.scenario} (${result.duration}ms)`);
    });
    console.log('');
  }

  if (failed.length > 0) {
    console.log('❌ FAILED SCENARIOS:');
    failed.forEach(result => {
      console.log(`  • ${result.scenario}: ${result.error}`);
    });
    console.log('');
  }

  // Performance metrics
  if (successful.length > 0) {
    const avgDuration = successful.reduce((sum, r) => sum + r.duration, 0) / successful.length;
    console.log('📈 PERFORMANCE METRICS:');
    console.log(`  Average scenario duration: ${Math.round(avgDuration)}ms`);
    console.log(`  Fastest scenario: ${Math.min(...successful.map(r => r.duration))}ms`);
    console.log(`  Slowest scenario: ${Math.max(...successful.map(r => r.duration))}ms`);
    console.log('');
  }

  // Integration readiness assessment
  const readiness = {
    contractDeployment: successful.length > 0,
    databaseIntegration: successful.some(r => r.result?.phases?.verification?.verification?.databaseContractSync),
    userSimulation: successful.some(r => r.result?.phases?.participation?.length > 0),
    blockchainRecording: successful.some(r => r.result?.phases?.recording?.length > 0),
    overallReadiness: successful.length === scenarioResults.length
  };

  console.log('🔍 INTEGRATION READINESS:');
  console.log(`  Contract Deployment: ${readiness.contractDeployment ? '✅' : '❌'}`);
  console.log(`  Database Integration: ${readiness.databaseIntegration ? '✅' : '❌'}`);
  console.log(`  User Simulation: ${readiness.userSimulation ? '✅' : '❌'}`);
  console.log(`  Blockchain Recording: ${readiness.blockchainRecording ? '✅' : '❌'}`);
  console.log(`  Overall Readiness: ${readiness.overallReadiness ? '✅' : '❌'}`);

  if (readiness.overallReadiness) {
    console.log('\n🎉 SIMULATION SUCCESSFUL!');
    console.log('The quiz lifecycle simulation completed successfully.');
    console.log('Ready to proceed with Base Sepolia deployment and Collab.Land integration.');
  } else {
    console.log('\n⚠️  SIMULATION INCOMPLETE');
    console.log('Some scenarios failed. Review errors before proceeding to Base Sepolia.');
  }

  console.log('═'.repeat(60));

  return {
    duration,
    scenarios: scenarioResults,
    performance: successful.length > 0 ? {
      averageDuration: successful.reduce((sum, r) => sum + r.duration, 0) / successful.length,
      fastest: Math.min(...successful.map(r => r.duration)),
      slowest: Math.max(...successful.map(r => r.duration))
    } : null,
    readiness
  };
}

/**
 * Main execution function
 */
async function main() {
  const startTime = Date.now();

  console.log('🚀 Quiz Lifecycle Simulation Starting...\n');
  console.log('This simulation will:');
  console.log('1. Deploy MotherFactory and QuizHandler contracts');
  console.log('2. Create quiz and deploy QuizEscrow via factory');
  console.log('3. Simulate multiple users taking the quiz');
  console.log('4. Record results on-chain via smart contracts');
  console.log('5. Verify database and contract state consistency');
  console.log('6. Generate comprehensive report\n');

  try {
    // Deploy contracts
    const contracts = await deployContracts();

    // Run simulation scenarios
    const scenarioResults = await runSimulationScenarios(contracts);

    // Generate final report
    const report = generateReport(scenarioResults, startTime);

    // Save report to file for reference
    const fs = require('fs');
    const reportPath = './simulation-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📝 Detailed report saved to: ${reportPath}`);

    process.exit(report.readiness.overallReadiness ? 0 : 1);

  } catch (error) {
    console.error('\n💥 SIMULATION CRASHED:', error);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  main().catch(error => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
}

module.exports = { main, deployContracts, runSimulationScenarios, generateReport };
