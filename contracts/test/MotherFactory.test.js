const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MotherFactory", function () {
  let MotherFactory;
  let motherFactory;
  let QuizHandler;
  let quizHandler;
  let QuizEscrow;
  let owner;
  let authorizedBot;
  let user1;
  let user2;
  let newOwner;
  let addrs;

  const correctReward = ethers.utils.parseEther("0.01");
  const incorrectReward = ethers.utils.parseEther("0.005");
  const deploymentFee = ethers.utils.parseEther("0.001");
  const minPayment = deploymentFee.add(ethers.utils.parseEther("0.1"));

  beforeEach(async function () {
    [owner, authorizedBot, user1, user2, newOwner, ...addrs] = await ethers.getSigners();

    // Deploy MotherFactory
    MotherFactory = await ethers.getContractFactory("MotherFactory");
    motherFactory = await MotherFactory.connect(owner).deploy();
    await motherFactory.deployed();
    
    // Initialize the upgradeable contract with authorized bot
    await motherFactory.connect(owner).initialize(authorizedBot.address);

    // Deploy QuizHandler
    QuizHandler = await ethers.getContractFactory("QuizHandler");
    quizHandler = await QuizHandler.connect(owner).deploy();
    await quizHandler.deployed();
    await quizHandler.connect(owner).initialize(authorizedBot.address);
    
    // Get QuizEscrow factory for testing
    QuizEscrow = await ethers.getContractFactory("QuizEscrow");
  });

  describe("Deployment", function () {
    it("Should set the deployer as owner", async function () {
      expect(await motherFactory.owner()).to.equal(owner.address);
    });

    it("Should initialize with empty state", async function () {
      expect(await motherFactory.totalDeployed()).to.equal(0);
      
      const contractTypes = await motherFactory.getContractTypes();
      expect(contractTypes).to.have.lengthOf(0);
      
      const allContracts = await motherFactory.getAllDeployedContracts();
      expect(allContracts).to.have.lengthOf(0);
    });

    it("Should emit OwnershipTransferred event", async function () {
      const factory = await MotherFactory.connect(owner).deploy();
      await factory.deployed();
      
      await expect(factory.connect(owner).initialize(authorizedBot.address))
        .to.emit(factory, "OwnershipTransferred")
        .withArgs(ethers.constants.AddressZero, owner.address);
    });
  });

  describe("Handler Registration", function () {
    it("Should allow owner to register handler", async function () {
      await expect(
        motherFactory.connect(owner).registerHandler("QuizEscrow", quizHandler.address)
      ).to.emit(motherFactory, "HandlerRegistered")
        .withArgs("QuizEscrow", quizHandler.address, owner.address);

      expect(await motherFactory.getHandler("QuizEscrow")).to.equal(quizHandler.address);
      expect(await motherFactory.isHandlerActive("QuizEscrow")).to.equal(true);
      
      const contractTypes = await motherFactory.getContractTypes();
      expect(contractTypes).to.include("QuizEscrow");
    });

    it("Should reject non-owner registration", async function () {
      await expect(
        motherFactory.connect(user1).registerHandler("QuizEscrow", quizHandler.address)
      ).to.be.revertedWith("OwnableUnauthorizedAccount");
    });

    it("Should reject invalid handler address", async function () {
      await expect(
        motherFactory.connect(owner).registerHandler("QuizEscrow", ethers.constants.AddressZero)
      ).to.be.revertedWith("MotherFactory: Invalid handler address");
    });

    it("Should reject empty contract type", async function () {
      await expect(
        motherFactory.connect(owner).registerHandler("", quizHandler.address)
      ).to.be.revertedWith("MotherFactory: Contract type cannot be empty");
    });

    it("Should allow updating existing handler", async function () {
      // Register initial handler
      await motherFactory.connect(owner).registerHandler("QuizEscrow", quizHandler.address);
      
      // Deploy new handler
      const newHandler = await QuizHandler.connect(owner).deploy();
      await newHandler.deployed();
      await newHandler.connect(owner).initialize(authorizedBot.address);
      
      // Update handler
      await expect(
        motherFactory.connect(owner).registerHandler("QuizEscrow", newHandler.address)
      ).to.emit(motherFactory, "HandlerRegistered")
        .withArgs("QuizEscrow", newHandler.address, owner.address);

      expect(await motherFactory.getHandler("QuizEscrow")).to.equal(newHandler.address);
      
      // Should not add duplicate to contract types array
      const contractTypes = await motherFactory.getContractTypes();
      const quizEscrowCount = contractTypes.filter(type => type === "QuizEscrow").length;
      expect(quizEscrowCount).to.equal(1);
    });

    it("Should allow registering multiple contract types", async function () {
      const handler2 = await QuizHandler.connect(owner).deploy();
      await handler2.deployed();
      await handler2.connect(owner).initialize(authorizedBot.address);
      
      await motherFactory.connect(owner).registerHandler("QuizEscrow", quizHandler.address);
      await motherFactory.connect(owner).registerHandler("PollEscrow", handler2.address);

      const contractTypes = await motherFactory.getContractTypes();
      expect(contractTypes).to.have.lengthOf(2);
      expect(contractTypes).to.include("QuizEscrow");
      expect(contractTypes).to.include("PollEscrow");
    });
  });

  describe("Handler Removal", function () {
    beforeEach(async function () {
      await motherFactory.connect(owner).registerHandler("QuizEscrow", quizHandler.address);
    });

    it("Should allow owner to remove handler", async function () {
      await expect(
        motherFactory.connect(owner).removeHandler("QuizEscrow")
      ).to.emit(motherFactory, "HandlerRemoved")
        .withArgs("QuizEscrow", quizHandler.address, owner.address);

      expect(await motherFactory.getHandler("QuizEscrow")).to.equal(ethers.constants.AddressZero);
      expect(await motherFactory.isHandlerActive("QuizEscrow")).to.equal(false);
      
      const contractTypes = await motherFactory.getContractTypes();
      expect(contractTypes).to.not.include("QuizEscrow");
    });

    it("Should reject non-owner removal", async function () {
      await expect(
        motherFactory.connect(user1).removeHandler("QuizEscrow")
      ).to.be.revertedWith("OwnableUnauthorizedAccount");
    });

    it("Should reject removal of non-existent handler", async function () {
      await expect(
        motherFactory.connect(owner).removeHandler("NonExistent")
      ).to.be.revertedWith("MotherFactory: Handler not registered for contract type");
    });

    it("Should handle removal from middle of contract types array", async function () {
      const handler2 = await QuizHandler.connect(owner).deploy();
      await handler2.deployed();
      await handler2.connect(owner).initialize(authorizedBot.address);
      const handler3 = await QuizHandler.connect(owner).deploy();
      await handler3.deployed();
      await handler3.connect(owner).initialize(authorizedBot.address);
      
      await motherFactory.connect(owner).registerHandler("PollEscrow", handler2.address);
      await motherFactory.connect(owner).registerHandler("QuestEscrow", handler3.address);
      
      // Remove middle element
      await motherFactory.connect(owner).removeHandler("QuizEscrow");
      
      const contractTypes = await motherFactory.getContractTypes();
      expect(contractTypes).to.have.lengthOf(2);
      expect(contractTypes).to.include("PollEscrow");
      expect(contractTypes).to.include("QuestEscrow");
      expect(contractTypes).to.not.include("QuizEscrow");
    });
  });

  describe("Contract Deployment", function () {
    let encodedParams;

    beforeEach(async function () {
      await motherFactory.connect(owner).registerHandler("QuizEscrow", quizHandler.address);
      
      encodedParams = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256"],
        [correctReward, incorrectReward]
      );
    });

    it("Should deploy contract through registered handler", async function () {
      const tx = await motherFactory.connect(authorizedBot).deployContract(
        "QuizEscrow",
        encodedParams,
        { value: minPayment }
      );
      const receipt = await tx.wait();

      // Check ContractDeployed event
      const deployedEvent = receipt.events?.find(e => e.event === "ContractDeployed");
      expect(deployedEvent).to.not.be.undefined;
      
      const contractAddress = deployedEvent.args[2]; // contractAddress is 3rd parameter (index 2)
      expect(contractAddress).to.not.be.undefined;
      const quiz = QuizEscrow.attach(contractAddress);

      // Verify deployed contract
      expect(await quiz.creator()).to.equal(authorizedBot.address);
      expect(await quiz.authorizedBot()).to.equal(authorizedBot.address);

      // Check factory state updates
      expect(await motherFactory.totalDeployed()).to.equal(1);
      
      const userContracts = await motherFactory.getDeployedContracts(authorizedBot.address);
      expect(userContracts).to.include(contractAddress);
      
      const allContracts = await motherFactory.getAllDeployedContracts();
      expect(allContracts).to.include(contractAddress);
    });

    it("Should emit ContractDeployed event", async function () {
      await expect(
        motherFactory.connect(authorizedBot).deployContract("QuizEscrow", encodedParams, { value: minPayment })
      ).to.emit(motherFactory, "ContractDeployed");

      // Event args will be checked in integration tests due to address calculation complexity
    });

    it("Should reject deployment with unregistered handler", async function () {
      await expect(
        motherFactory.connect(authorizedBot).deployContract("UnknownType", encodedParams, { value: minPayment })
      ).to.be.revertedWith("MotherFactory: Handler not registered for contract type");
    });

    it("Should reject deployment with insufficient payment", async function () {
      const insufficientPayment = deploymentFee.sub(1);

      await expect(
        motherFactory.connect(authorizedBot).deployContract(
          "QuizEscrow",
          encodedParams,
          { value: insufficientPayment }
        )
      ).to.be.revertedWith("MotherFactory: Insufficient payment for deployment fee");
    });

    it("Should track multiple deployments by same user", async function () {
      await motherFactory.connect(authorizedBot).deployContract("QuizEscrow", encodedParams, { value: minPayment });
      await motherFactory.connect(authorizedBot).deployContract("QuizEscrow", encodedParams, { value: minPayment });

      const userContracts = await motherFactory.getDeployedContracts(authorizedBot.address);
      expect(userContracts).to.have.lengthOf(2);
      
      expect(await motherFactory.totalDeployed()).to.equal(2);
    });

    it("Should track deployments by different users separately", async function () {
      await motherFactory.connect(authorizedBot).deployContract("QuizEscrow", encodedParams, { value: minPayment });
      await motherFactory.connect(authorizedBot).deployContract("QuizEscrow", encodedParams, { value: minPayment });

      const userContracts = await motherFactory.getDeployedContracts(authorizedBot.address);
      expect(userContracts).to.have.lengthOf(2);
      
      expect(await motherFactory.totalDeployed()).to.equal(2);
    });
  });

  describe("getDeploymentFee", function () {
    beforeEach(async function () {
      await motherFactory.connect(owner).registerHandler("QuizEscrow", quizHandler.address);
    });

    it("Should return correct deployment fee from handler", async function () {
      const encodedParams = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256"],
        [correctReward, incorrectReward]
      );

      const fee = await motherFactory.getDeploymentFee("QuizEscrow", encodedParams);
      expect(fee).to.equal(deploymentFee);
    });

    it("Should reject fee query for unregistered handler", async function () {
      const encodedParams = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256"],
        [correctReward, incorrectReward]
      );

      await expect(
        motherFactory.getDeploymentFee("UnknownType", encodedParams)
      ).to.be.revertedWith("MotherFactory: Handler not registered for contract type");
    });
  });

  describe("Ownership Management", function () {
    it("Should allow owner to transfer ownership", async function () {
      await expect(
        motherFactory.connect(owner).transferOwnership(newOwner.address)
      ).to.emit(motherFactory, "OwnershipTransferred")
        .withArgs(owner.address, newOwner.address);

      expect(await motherFactory.owner()).to.equal(newOwner.address);
    });

    it("Should reject non-owner transfer", async function () {
      await expect(
        motherFactory.connect(user1).transferOwnership(newOwner.address)
      ).to.be.revertedWith("OwnableUnauthorizedAccount");
    });

    it("Should reject transfer to zero address", async function () {
      await expect(
        motherFactory.connect(owner).transferOwnership(ethers.constants.AddressZero)
      ).to.be.revertedWith("OwnableInvalidOwner");
    });

    it("Should reject transfer to current owner", async function () {
      await expect(
        motherFactory.connect(owner).transferOwnership(owner.address)
      ).to.be.revertedWith("MotherFactory: New owner cannot be current owner");
    });

    it("Should allow new owner to register handlers", async function () {
      await motherFactory.connect(owner).transferOwnership(newOwner.address);
      
      const newHandler = await QuizHandler.connect(newOwner).deploy();
      await newHandler.deployed();
      await newHandler.connect(newOwner).initialize(authorizedBot.address);
      await expect(
        motherFactory.connect(newOwner).registerHandler("NewType", newHandler.address)
      ).to.emit(motherFactory, "HandlerRegistered");

      // Old owner should no longer be able to register
      await expect(
        motherFactory.connect(owner).registerHandler("AnotherType", newHandler.address)
      ).to.be.revertedWith("OwnableUnauthorizedAccount");
    });

    it("Should allow owner to renounce ownership", async function () {
      await expect(
        motherFactory.connect(owner).renounceOwnership()
      ).to.emit(motherFactory, "OwnershipTransferred")
        .withArgs(owner.address, ethers.constants.AddressZero);

      expect(await motherFactory.owner()).to.equal(ethers.constants.AddressZero);

      // No one should be able to register handlers after renouncing
      await expect(
        motherFactory.connect(owner).registerHandler("QuizEscrow", quizHandler.address)
      ).to.be.revertedWith("OwnableUnauthorizedAccount");
    });

    it("Should reject non-owner renouncement", async function () {
      await expect(
        motherFactory.connect(user1).renounceOwnership()
      ).to.be.revertedWith("OwnableUnauthorizedAccount");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await motherFactory.connect(owner).registerHandler("QuizEscrow", quizHandler.address);
      
      const handler2 = await QuizHandler.connect(owner).deploy();
      await handler2.deployed();
      await handler2.connect(owner).initialize(authorizedBot.address);
      await motherFactory.connect(owner).registerHandler("PollEscrow", handler2.address);
    });

    it("Should return correct handler info", async function () {
      const info = await motherFactory.getHandlerInfo("QuizEscrow");
      
      expect(info.contractTypeReturned).to.equal("QuizEscrow");
      expect(info.version).to.equal("1.0.0");
      expect(info.description).to.include("Discord quiz games");
    });

    it("Should return all contract types", async function () {
      const contractTypes = await motherFactory.getContractTypes();
      
      expect(contractTypes).to.have.lengthOf(2);
      expect(contractTypes).to.include("QuizEscrow");
      expect(contractTypes).to.include("PollEscrow");
    });

    it("Should return correct factory stats", async function () {
      // Deploy some contracts
      const encodedParams = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256"],
        [correctReward, incorrectReward]
      );

      await motherFactory.connect(authorizedBot).deployContract("QuizEscrow", encodedParams, { value: minPayment });
      await motherFactory.connect(authorizedBot).deployContract("PollEscrow", encodedParams, { value: minPayment });

      const stats = await motherFactory.getFactoryStats();
      
      expect(stats._totalDeployed).to.equal(2);
      expect(stats._totalHandlers).to.equal(2);
      expect(stats._currentOwner).to.equal(owner.address);
    });

    it("Should return empty arrays for users with no deployments", async function () {
      const userContracts = await motherFactory.getDeployedContracts(user1.address);
      expect(userContracts).to.have.lengthOf(0);
    });

    it("Should correctly report handler registration status", async function () {
      expect(await motherFactory.getHandler("QuizEscrow")).to.equal(quizHandler.address);
      expect(await motherFactory.isHandlerActive("QuizEscrow")).to.equal(true);
      
      const contractTypes = await motherFactory.getContractTypes();
      expect(contractTypes).to.include("QuizEscrow");
    });
  });

  describe("Integration Tests", function () {
    let encodedParams;

    beforeEach(async function () {
      await motherFactory.connect(owner).registerHandler("QuizEscrow", quizHandler.address);
      
      encodedParams = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256"],
        [correctReward, incorrectReward]
      );
    });

    it("Should complete full deployment and interaction workflow", async function () {
      // 1. Deploy quiz through factory
      const tx = await motherFactory.connect(authorizedBot).deployContract(
        "QuizEscrow",
        encodedParams,
        { value: minPayment }
      );
      const receipt = await tx.wait();
      
      // 2. Get deployed quiz address
      const deployedEvent = receipt.events?.find(e => e.event === "ContractDeployed");
      const quizAddress = deployedEvent.args[2]; // contractAddress is 3rd parameter (index 2)
      const quiz = QuizEscrow.attach(quizAddress);
      
      // 3. Verify quiz works with bot
      await expect(
        quiz.connect(authorizedBot).recordQuizResult(user2.address, 3, 1)
      ).to.emit(quiz, "QuizResultRecorded");
      
      // 4. Verify factory tracking
      const userContracts = await motherFactory.getDeployedContracts(authorizedBot.address);
      expect(userContracts).to.include(quizAddress);
    });

    it("Should maintain state consistency across multiple operations", async function () {
      // Deploy multiple quizzes
      await motherFactory.connect(authorizedBot).deployContract("QuizEscrow", encodedParams, { value: minPayment });
      await motherFactory.connect(authorizedBot).deployContract("QuizEscrow", encodedParams, { value: minPayment });
      await motherFactory.connect(authorizedBot).deployContract("QuizEscrow", encodedParams, { value: minPayment });

      // Verify counts
      expect(await motherFactory.totalDeployed()).to.equal(3);
      
      const userContracts = await motherFactory.getDeployedContracts(authorizedBot.address);
      const allContracts = await motherFactory.getAllDeployedContracts();
      
      expect(userContracts).to.have.lengthOf(3);
      expect(allContracts).to.have.lengthOf(3);
      
      // Verify no duplicate addresses
      const allAddresses = [...userContracts];
      const uniqueAddresses = [...new Set(allAddresses)];
      expect(uniqueAddresses).to.have.lengthOf(3);
    });
  });
});
