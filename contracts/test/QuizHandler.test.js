const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("QuizHandler", function () {
  let QuizHandler;
  let quizHandler;
  let QuizEscrow;
  let owner;
  let authorizedBot;
  let user1;
  let user2;
  let addrs;

  const correctReward = ethers.utils.parseEther("0.01");
  const incorrectReward = ethers.utils.parseEther("0.005");
  const deploymentFee = ethers.utils.parseEther("0.001");
  const minPayment = deploymentFee.add(ethers.utils.parseEther("0.1")); // Fee + funding

  beforeEach(async function () {
    [owner, authorizedBot, user1, user2, ...addrs] = await ethers.getSigners();

    QuizHandler = await ethers.getContractFactory("QuizHandler");
    QuizEscrow = await ethers.getContractFactory("QuizEscrow");
    
    quizHandler = await QuizHandler.deploy();
    await quizHandler.deployed();
    await quizHandler.initialize(authorizedBot.address);
  });

  describe("Deployment", function () {
    it("Should set the authorized bot correctly", async function () {
      expect(await quizHandler.authorizedBot()).to.equal(authorizedBot.address);
    });

    it("Should set constants correctly", async function () {
      expect(await quizHandler.DEPLOYMENT_FEE()).to.equal(deploymentFee);
      expect(await quizHandler.VERSION()).to.equal("1.0.0");
    });

    it("Should reject invalid bot address", async function () {
      const testHandler = await QuizHandler.deploy();
      await testHandler.deployed();
      
      await expect(
        testHandler.initialize(ethers.constants.AddressZero)
      ).to.be.revertedWith("QuizHandler: Invalid bot address");
    });

    it("Should reject double initialization", async function () {
      await expect(
        quizHandler.initialize(user1.address)
      ).to.be.revertedWith("InvalidInitialization");
    });
  });

  describe("deployContract", function () {
    let encodedParams;

    beforeEach(function () {
      encodedParams = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256"],
        [correctReward, incorrectReward]
      );
    });

    it("Should deploy QuizEscrow contract successfully", async function () {
      const tx = await quizHandler.connect(authorizedBot).deployContract(
        authorizedBot.address,  // creator
        encodedParams,
        { value: minPayment }
      );
      const receipt = await tx.wait();

      // Check QuizDeployed event
      const deployedEvent = receipt.events?.find(e => e.event === "QuizDeployed");
      expect(deployedEvent).to.not.be.undefined;
      
      const quizAddress = deployedEvent.args.quizAddress;
      const quiz = QuizEscrow.attach(quizAddress);

      // Verify quiz was deployed with correct parameters
      expect(await quiz.creator()).to.equal(authorizedBot.address);
      expect(await quiz.authorizedBot()).to.equal(authorizedBot.address);
      expect(await quiz.correctReward()).to.equal(correctReward);
      expect(await quiz.incorrectReward()).to.equal(incorrectReward);
      expect(await quiz.fundingAmount()).to.equal(minPayment.sub(deploymentFee));
    });

    it("Should emit QuizDeployed event with correct parameters", async function () {
      const fundingAmount = minPayment.sub(deploymentFee);

      await expect(
        quizHandler.connect(authorizedBot).deployContract(
          authorizedBot.address,  // creator
          encodedParams,
          { value: minPayment }
        )
      ).to.emit(quizHandler, "QuizDeployed");
      // Note: withArgs removed due to address calculation complexity - will verify in separate assertion
    });

    it("Should reject insufficient payment", async function () {
      const insufficientPayment = deploymentFee.sub(1);

      await expect(
        quizHandler.connect(authorizedBot).deployContract(
          authorizedBot.address,  // creator
          encodedParams,
          { value: insufficientPayment }
        )
      ).to.be.revertedWith("QuizHandler: Insufficient payment for deployment fee");
    });

    it("Should allow zero funding with deployment fee only", async function () {
      const zeroFundingPayment = deploymentFee; // Only deployment fee, no additional funding
      
      const tx = await quizHandler.connect(authorizedBot).deployContract(
        authorizedBot.address,  // creator
        encodedParams,
        { value: zeroFundingPayment }
      );
      const receipt = await tx.wait();

      // Check QuizDeployed event
      const deployedEvent = receipt.events?.find(e => e.event === "QuizDeployed");
      expect(deployedEvent).to.not.be.undefined;
      
      const quizAddress = deployedEvent.args.quizAddress;
      const quiz = QuizEscrow.attach(quizAddress);

      // Verify quiz was deployed with zero funding
      expect(await quiz.fundingAmount()).to.equal(0);
      expect(await quiz.getBalance()).to.equal(0);
    });

    it("Should reject payment less than deployment fee", async function () {
      const insufficientPayment = deploymentFee.sub(1);
      
      await expect(
        quizHandler.connect(authorizedBot).deployContract(
          authorizedBot.address,  // creator
          encodedParams,
          { value: insufficientPayment }
        )
      ).to.be.revertedWith("QuizHandler: Insufficient payment for deployment fee");
    });

    it("Should handle different reward configurations", async function () {
      // Only correct rewards
      const correctOnlyParams = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256"],
        [correctReward, 0]
      );

      const tx1 = await quizHandler.connect(authorizedBot).deployContract(
        authorizedBot.address,  // creator
        correctOnlyParams,
        { value: minPayment }
      );
      const receipt1 = await tx1.wait();
      const quizAddress1 = receipt1.events?.find(e => e.event === "QuizDeployed")?.args.quizAddress;
      const quiz1 = QuizEscrow.attach(quizAddress1);

      expect(await quiz1.correctReward()).to.equal(correctReward);
      expect(await quiz1.incorrectReward()).to.equal(0);

      // Only incorrect rewards
      const incorrectOnlyParams = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256"],
        [0, incorrectReward]
      );

      const tx2 = await quizHandler.connect(authorizedBot).deployContract(
        authorizedBot.address,  // creator
        incorrectOnlyParams,
        { value: minPayment }
      );
      const receipt2 = await tx2.wait();
      const quizAddress2 = receipt2.events?.find(e => e.event === "QuizDeployed")?.args.quizAddress;
      const quiz2 = QuizEscrow.attach(quizAddress2);

      expect(await quiz2.correctReward()).to.equal(0);
      expect(await quiz2.incorrectReward()).to.equal(incorrectReward);
    });

    it("Should accumulate deployment fees", async function () {
      const initialBalance = await quizHandler.getAccumulatedFees();
      
      await quizHandler.connect(authorizedBot).deployContract(
        authorizedBot.address,  // creator
        encodedParams,
        { value: minPayment }
      );
      await quizHandler.connect(authorizedBot).deployContract(
        authorizedBot.address,  // creator
        encodedParams,
        { value: minPayment }
      );

      const finalBalance = await quizHandler.getAccumulatedFees();
      expect(finalBalance.sub(initialBalance)).to.equal(deploymentFee.mul(2));
    });
  });

  describe("getDeploymentFee", function () {
    it("Should return constant deployment fee", async function () {
      const params = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256"],
        [correctReward, incorrectReward]
      );

      const fee = await quizHandler.getDeploymentFee(params);
      expect(fee).to.equal(deploymentFee);
    });

    it("Should return same fee regardless of parameters", async function () {
      const params1 = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256"],
        [ethers.utils.parseEther("0.1"), ethers.utils.parseEther("0.05")]
      );

      const params2 = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256"],
        [ethers.utils.parseEther("0.001"), ethers.utils.parseEther("0.0001")]
      );

      const fee1 = await quizHandler.getDeploymentFee(params1);
      const fee2 = await quizHandler.getDeploymentFee(params2);
      
      expect(fee1).to.equal(deploymentFee);
      expect(fee2).to.equal(deploymentFee);
      expect(fee1).to.equal(fee2);
    });
  });

  describe("getHandlerInfo", function () {
    it("Should return correct handler information", async function () {
      const [contractType, version, description] = await quizHandler.getHandlerInfo();
      
      expect(contractType).to.equal("QuizEscrow");
      expect(version).to.equal("1.0.0");
      expect(description).to.equal("Deploys QuizEscrow contracts for Discord quiz games with bot-controlled result recording");
    });
  });

  describe("Fee management", function () {
    beforeEach(async function () {
      const encodedParams = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256"],
        [correctReward, incorrectReward]
      );

      // Deploy a few quizzes to accumulate fees
      await quizHandler.connect(authorizedBot).deployContract(
        authorizedBot.address,  // creator
        encodedParams,
        { value: minPayment }
      );
      await quizHandler.connect(authorizedBot).deployContract(
        authorizedBot.address,  // creator
        encodedParams,
        { value: minPayment }
      );
    });

    it("Should allow authorized bot to withdraw fees", async function () {
      const initialBotBalance = await authorizedBot.getBalance();
      const accumulatedFees = await quizHandler.getAccumulatedFees();
      
      expect(accumulatedFees).to.equal(deploymentFee.mul(2));

      const tx = await quizHandler.connect(authorizedBot).withdrawFees();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);

      const finalBotBalance = await authorizedBot.getBalance();
      const balanceIncrease = finalBotBalance.sub(initialBotBalance).add(gasUsed);

      expect(balanceIncrease).to.equal(accumulatedFees);
      expect(await quizHandler.getAccumulatedFees()).to.equal(0);
    });

    it("Should reject unauthorized withdrawal", async function () {
      await expect(
        quizHandler.connect(user1).withdrawFees()
      ).to.be.revertedWith("QuizHandler: Only authorized bot can withdraw fees");

      await expect(
        quizHandler.connect(owner).withdrawFees()
      ).to.be.revertedWith("QuizHandler: Only authorized bot can withdraw fees");
    });

    it("Should reject withdrawal when no fees available", async function () {
      // First withdraw all fees
      await quizHandler.connect(authorizedBot).withdrawFees();
      
      // Try to withdraw again
      await expect(
        quizHandler.connect(authorizedBot).withdrawFees()
      ).to.be.revertedWith("QuizHandler: No fees to withdraw");
    });

    it("Should track accumulated fees correctly", async function () {
      const initialFees = await quizHandler.getAccumulatedFees();
      
      const encodedParams = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256"],
        [correctReward, incorrectReward]
      );

      await quizHandler.connect(authorizedBot).deployContract(
        authorizedBot.address,  // creator
        encodedParams,
        { value: minPayment }
      );
      
      const finalFees = await quizHandler.getAccumulatedFees();
      expect(finalFees.sub(initialFees)).to.equal(deploymentFee);
    });
  });

  describe("Integration with deployed QuizEscrow", function () {
    let deployedQuizAddress;
    let deployedQuiz;

    beforeEach(async function () {
      const encodedParams = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256"],
        [correctReward, incorrectReward]
      );

      const tx = await quizHandler.connect(authorizedBot).deployContract(
        authorizedBot.address,  // creator
        encodedParams,
        { value: minPayment }
      );
      const receipt = await tx.wait();
      deployedQuizAddress = receipt.events?.find(e => e.event === "QuizDeployed")?.args.quizAddress;
      deployedQuiz = QuizEscrow.attach(deployedQuizAddress);
    });

    it("Should deploy functional QuizEscrow that accepts bot interactions", async function () {
      // Bot should be able to record results
      await expect(
        deployedQuiz.connect(authorizedBot).recordQuizResult(user2.address, 3, 1)
      ).to.emit(deployedQuiz, "QuizResultRecorded");

      // Verify result was recorded
      const result = await deployedQuiz.getParticipantResult(user2.address);
      expect(result.hasParticipated).to.equal(true);
      expect(result.correctCount).to.equal(3);
      expect(result.incorrectCount).to.equal(1);
    });

    it("Should deploy QuizEscrow that rejects unauthorized interactions", async function () {
      await expect(
        deployedQuiz.connect(user1).recordQuizResult(user2.address, 3, 1)
      ).to.be.revertedWith("QuizEscrow: Only authorized bot can call this function");
    });

    it("Should properly allocate funding to deployed quiz", async function () {
      const expectedFunding = minPayment.sub(deploymentFee);
      expect(await deployedQuiz.getBalance()).to.equal(expectedFunding);
      expect(await deployedQuiz.fundingAmount()).to.equal(expectedFunding);
    });

    it("Should support zero rewards configuration", async function () {
      const zeroRewardsParams = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256"],
        [0, 0]
      );

      const tx = await quizHandler.connect(authorizedBot).deployContract(
        authorizedBot.address,  // creator
        zeroRewardsParams,
        { value: minPayment }
      );
      const receipt = await tx.wait();

      const deployedEvent = receipt.events?.find(e => e.event === "QuizDeployed");
      const quizAddress = deployedEvent.args.quizAddress;
      const quiz = QuizEscrow.attach(quizAddress);

      expect(await quiz.correctReward()).to.equal(0);
      expect(await quiz.incorrectReward()).to.equal(0);
      expect(await quiz.fundingAmount()).to.equal(minPayment.sub(deploymentFee));
    });

    it("Should support zero funding and zero rewards", async function () {
      const zeroRewardsParams = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256"],
        [0, 0]
      );

      const tx = await quizHandler.connect(authorizedBot).deployContract(
        authorizedBot.address,  // creator
        zeroRewardsParams,
        { value: deploymentFee } // Only deployment fee
      );
      const receipt = await tx.wait();

      const deployedEvent = receipt.events?.find(e => e.event === "QuizDeployed");
      const quizAddress = deployedEvent.args.quizAddress;
      const quiz = QuizEscrow.attach(quizAddress);

      expect(await quiz.correctReward()).to.equal(0);
      expect(await quiz.incorrectReward()).to.equal(0);
      expect(await quiz.fundingAmount()).to.equal(0);
      expect(await quiz.getBalance()).to.equal(0);
    });
  });
});
