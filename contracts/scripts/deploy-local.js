const { ethers } = require("hardhat");

async function main() {
  console.log("=== Deploying Contracts to Local Hardhat Network ===\n");
  
  // Get signers
  const [deployer, authorizedBot, proxyAdmin] = await ethers.getSigners();
  
  console.log("Deploying with the account:", deployer.address);
  console.log("Authorized bot:", deployer.address); // Use deployer as bot for simulation
  console.log("Proxy admin:", proxyAdmin.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());
  console.log();

  // Step 1: Deploy MotherFactory logic contract
  console.log("🔧 Deploying MotherFactory logic contract...");
  const MotherFactory = await ethers.getContractFactory("MotherFactory");
  const motherFactoryLogic = await MotherFactory.deploy();
  await motherFactoryLogic.deployed();
  console.log("✅ MotherFactory logic deployed to:", motherFactoryLogic.address);

  // Step 2: Deploy QuizHandler logic contract
  console.log("🔧 Deploying QuizHandler logic contract...");
  const QuizHandler = await ethers.getContractFactory("QuizHandler");
  const quizHandlerLogic = await QuizHandler.deploy(); // No constructor arguments needed
  await quizHandlerLogic.deployed();
  console.log("✅ QuizHandler logic deployed to:", quizHandlerLogic.address);

  // Step 3: Deploy MotherFactory proxy
  console.log("🔧 Deploying MotherFactory proxy...");
  const MotherFactoryProxy = await ethers.getContractFactory("MotherFactoryProxy");
  
  // Initialize data for MotherFactory - encode the initialize() call
  const initData = MotherFactory.interface.encodeFunctionData("initialize");
  
  const motherFactoryProxy = await MotherFactoryProxy.deploy(
    motherFactoryLogic.address,
    proxyAdmin.address,
    initData
  );
  await motherFactoryProxy.deployed();
  console.log("✅ MotherFactory proxy deployed to:", motherFactoryProxy.address);

  // Step 4: Deploy QuizHandler proxy
  console.log("🔧 Deploying QuizHandler proxy...");
  const QuizHandlerProxy = await ethers.getContractFactory("QuizHandlerProxy");
  
  // Encode initialize call for QuizHandler with authorized bot
  const quizHandlerInitData = QuizHandler.interface.encodeFunctionData(
    "initialize",
    [authorizedBot.address] // Pass authorized bot address to initialize function
  );
  
  const quizHandlerProxy = await QuizHandlerProxy.deploy(
    quizHandlerLogic.address,
    proxyAdmin.address,
    quizHandlerInitData
  );
  await quizHandlerProxy.deployed();
  console.log("✅ QuizHandler proxy deployed to:", quizHandlerProxy.address);

  // Step 5: Connect to proxies via logic contract interfaces
  console.log("🔧 Connecting to proxy contracts...");
  const motherFactory = MotherFactory.attach(motherFactoryProxy.address);
  const quizHandler = QuizHandler.attach(quizHandlerProxy.address);

  // Step 6: Register QuizHandler in MotherFactory
  console.log("🔧 Registering QuizHandler in MotherFactory...");
  const registerTx = await motherFactory.registerHandler("QuizEscrow", quizHandler.address);
  await registerTx.wait();
  console.log("✅ QuizHandler registered for QuizEscrow contracts");

  // Step 7: Verification tests
  console.log("\n=== Verification Tests ===");
  
  // Test 1: Check MotherFactory owner
  const owner = await motherFactory.owner();
  console.log("✅ MotherFactory owner:", owner);
  console.log("✅ Expected deployer:", deployer.address);
  console.log("✅ Owner match:", owner === deployer.address);

  // Test 2: Check registered handler
  const [handlerAddress, isActive] = await motherFactory.getHandlerInfo("QuizEscrow");
  console.log("✅ Registered handler:", handlerAddress);
  console.log("✅ Handler is active:", isActive);

  // Test 3: Check QuizHandler bot
  const botAddress = await quizHandler.authorizedBot();
  console.log("✅ QuizHandler authorized bot:", botAddress);
  console.log("✅ Bot match:", botAddress === authorizedBot.address);

  // Test 4: Check deployment fee
  const params = ethers.utils.defaultAbiCoder.encode(
    ["uint256", "uint256"],
    [ethers.utils.parseEther("0.01"), ethers.utils.parseEther("0.005")]
  );
  const deploymentFee = await motherFactory.getDeploymentFee("QuizEscrow", params);
  console.log("✅ Deployment fee:", ethers.utils.formatEther(deploymentFee), "ETH");

  console.log("\n=== Deployment Summary ===");
  console.log("MotherFactory Logic:", motherFactoryLogic.address);
  console.log("MotherFactory Proxy:", motherFactoryProxy.address);
  console.log("QuizHandler Logic:", quizHandlerLogic.address);
  console.log("QuizHandler Proxy:", quizHandlerProxy.address);
  console.log("Proxy Admin:", proxyAdmin.address);
  console.log("Authorized Bot:", authorizedBot.address);
  
  console.log("\n🎉 Local deployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
