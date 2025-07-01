const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("QuizEscrow", function () {
  let QuizEscrow;
  let quizEscrow;
  let owner;
  let authorizedBot;
  let participant1;
  let participant2;
  let participant3;
  let addrs;

  const correctReward = ethers.utils.parseEther("0.01"); // 0.01 ETH per correct answer
  const incorrectReward = ethers.utils.parseEther("0.005"); // 0.005 ETH per incorrect answer
  const fundingAmount = ethers.utils.parseEther("1.0"); // 1 ETH total funding

  beforeEach(async function () {
    [owner, authorizedBot, participant1, participant2, participant3, ...addrs] = await ethers.getSigners();

    QuizEscrow = await ethers.getContractFactory("QuizEscrow");
    quizEscrow = await QuizEscrow.deploy(
      owner.address,    // creator
      authorizedBot.address,
      correctReward,
      incorrectReward,
      { value: fundingAmount }
    );
    await quizEscrow.deployed();
  });

  describe("Deployment", function () {
    it("Should set the correct immutable variables", async function () {
      expect(await quizEscrow.authorizedBot()).to.equal(authorizedBot.address);
      expect(await quizEscrow.creator()).to.equal(owner.address);
      expect(await quizEscrow.fundingAmount()).to.equal(fundingAmount);
      expect(await quizEscrow.correctReward()).to.equal(correctReward);
      expect(await quizEscrow.incorrectReward()).to.equal(incorrectReward);
      expect(await quizEscrow.getBalance()).to.equal(fundingAmount);
    });

    it("Should initialize mutable state correctly", async function () {
      expect(await quizEscrow.totalPaidOut()).to.equal(0);
      expect(await quizEscrow.isEnded()).to.equal(false);
      expect(await quizEscrow.totalParticipants()).to.equal(0);
      expect(await quizEscrow.totalCorrectAnswers()).to.equal(0);
      expect(await quizEscrow.totalIncorrectAnswers()).to.equal(0);
    });

    it("Should emit QuizCreated event", async function () {
      const contract = await QuizEscrow.deploy(
        owner.address,    // creator
        authorizedBot.address,
        correctReward,
        incorrectReward,
        { value: fundingAmount }
      );
      
      await expect(contract.deployTransaction)
        .to.emit(contract, "QuizCreated")
        .withArgs(owner.address, authorizedBot.address, fundingAmount, correctReward, incorrectReward);
    });

    it("Should reject deployment with invalid parameters", async function () {
      // Invalid bot address
      await expect(
        QuizEscrow.deploy(
          owner.address,    // creator
          ethers.constants.AddressZero,
          correctReward,
          incorrectReward,
          { value: fundingAmount }
        )
      ).to.be.revertedWith("QuizEscrow: Invalid bot address");

      // Invalid creator address
      await expect(
        QuizEscrow.deploy(
          ethers.constants.AddressZero,    // creator
          authorizedBot.address,
          correctReward,
          incorrectReward,
          { value: fundingAmount }
        )
      ).to.be.revertedWith("QuizEscrow: Invalid creator address");
    });

    it("Should allow zero funding deployment", async function () {
      const zeroFundingQuiz = await QuizEscrow.deploy(
        owner.address,    // creator
        authorizedBot.address,
        correctReward,
        incorrectReward,
        { value: 0 }
      );

      expect(await zeroFundingQuiz.fundingAmount()).to.equal(0);
      expect(await zeroFundingQuiz.getBalance()).to.equal(0);
      expect(await zeroFundingQuiz.correctReward()).to.equal(correctReward);
      expect(await zeroFundingQuiz.incorrectReward()).to.equal(incorrectReward);
    });

    it("Should allow zero rewards deployment", async function () {
      const zeroRewardsQuiz = await QuizEscrow.deploy(
        owner.address,    // creator
        authorizedBot.address,
        0,
        0,
        { value: fundingAmount }
      );

      expect(await zeroRewardsQuiz.correctReward()).to.equal(0);
      expect(await zeroRewardsQuiz.incorrectReward()).to.equal(0);
      expect(await zeroRewardsQuiz.fundingAmount()).to.equal(fundingAmount);
      expect(await zeroRewardsQuiz.getBalance()).to.equal(fundingAmount);
    });

    it("Should allow zero funding and zero rewards deployment", async function () {
      const zeroEverythingQuiz = await QuizEscrow.deploy(
        owner.address,    // creator
        authorizedBot.address,
        0,
        0,
        { value: 0 }
      );

      expect(await zeroEverythingQuiz.correctReward()).to.equal(0);
      expect(await zeroEverythingQuiz.incorrectReward()).to.equal(0);
      expect(await zeroEverythingQuiz.fundingAmount()).to.equal(0);
      expect(await zeroEverythingQuiz.getBalance()).to.equal(0);
    });
  });

  describe("recordQuizResult", function () {
    it("Should allow authorized bot to record results", async function () {
      const correctCount = 3;
      const incorrectCount = 1;
      const expectedPayout = correctReward.mul(correctCount).add(incorrectReward.mul(incorrectCount));

      await expect(
        quizEscrow.connect(authorizedBot).recordQuizResult(
          participant1.address,
          correctCount,
          incorrectCount
        )
      ).to.emit(quizEscrow, "QuizResultRecorded")
        .withArgs(participant1.address, correctCount, incorrectCount, expectedPayout);

      // Check participant results
      const result = await quizEscrow.getParticipantResult(participant1.address);
      expect(result.correctCount).to.equal(correctCount);
      expect(result.incorrectCount).to.equal(incorrectCount);
      expect(result.totalPayout).to.equal(expectedPayout);
      expect(result.hasParticipated).to.equal(true);

      // Check global stats
      expect(await quizEscrow.totalParticipants()).to.equal(1);
      expect(await quizEscrow.totalCorrectAnswers()).to.equal(correctCount);
      expect(await quizEscrow.totalIncorrectAnswers()).to.equal(incorrectCount);
      expect(await quizEscrow.totalPaidOut()).to.equal(expectedPayout);
    });

    it("Should reject unauthorized callers", async function () {
      await expect(
        quizEscrow.connect(owner).recordQuizResult(participant1.address, 3, 1)
      ).to.be.revertedWith("QuizEscrow: Only authorized bot can call this function");

      await expect(
        quizEscrow.connect(participant1).recordQuizResult(participant1.address, 3, 1)
      ).to.be.revertedWith("QuizEscrow: Only authorized bot can call this function");
    });

    it("Should prevent double participation", async function () {
      await quizEscrow.connect(authorizedBot).recordQuizResult(participant1.address, 3, 1);

      await expect(
        quizEscrow.connect(authorizedBot).recordQuizResult(participant1.address, 2, 2)
      ).to.be.revertedWith("QuizEscrow: Participant already recorded");
    });

    it("Should reject invalid parameters", async function () {
      // Invalid participant address
      await expect(
        quizEscrow.connect(authorizedBot).recordQuizResult(
          ethers.constants.AddressZero,
          3,
          1
        )
      ).to.be.revertedWith("QuizEscrow: Invalid participant address");

      // No answers
      await expect(
        quizEscrow.connect(authorizedBot).recordQuizResult(participant1.address, 0, 0)
      ).to.be.revertedWith("QuizEscrow: Must have at least one answer");
    });

    it("Should handle insufficient funds gracefully", async function () {
      // Create a quiz with minimal funding
      const smallFunding = ethers.utils.parseEther("0.01");
      const smallQuiz = await QuizEscrow.deploy(
        owner.address,    // creator
        authorizedBot.address,
        correctReward,
        incorrectReward,
        { value: smallFunding }
      );

      // Try to record a result that would require more than available funds
      await expect(
        smallQuiz.connect(authorizedBot).recordQuizResult(participant1.address, 10, 0)
      ).to.be.revertedWith("QuizEscrow: Insufficient funds for payout");
    });

    it("Should handle multiple participants correctly", async function () {
      // Record results for multiple participants
      await quizEscrow.connect(authorizedBot).recordQuizResult(participant1.address, 3, 1);
      await quizEscrow.connect(authorizedBot).recordQuizResult(participant2.address, 2, 2);
      await quizEscrow.connect(authorizedBot).recordQuizResult(participant3.address, 4, 0);

      // Check global stats
      expect(await quizEscrow.totalParticipants()).to.equal(3);
      expect(await quizEscrow.totalCorrectAnswers()).to.equal(9); // 3 + 2 + 4
      expect(await quizEscrow.totalIncorrectAnswers()).to.equal(3); // 1 + 2 + 0

      // Check participants list
      const participants = await quizEscrow.getAllParticipants();
      expect(participants).to.have.lengthOf(3);
      expect(participants).to.include(participant1.address);
      expect(participants).to.include(participant2.address);
      expect(participants).to.include(participant3.address);
    });

    it("Should pay participants immediately", async function () {
      const initialBalance = await participant1.getBalance();
      const expectedPayout = correctReward.mul(3).add(incorrectReward.mul(1));

      await quizEscrow.connect(authorizedBot).recordQuizResult(participant1.address, 3, 1);

      const finalBalance = await participant1.getBalance();
      expect(finalBalance.sub(initialBalance)).to.equal(expectedPayout);
    });
  });

  describe("endQuiz", function () {
    beforeEach(async function () {
      // Add some participants
      await quizEscrow.connect(authorizedBot).recordQuizResult(participant1.address, 3, 1);
      await quizEscrow.connect(authorizedBot).recordQuizResult(participant2.address, 2, 2);
    });

    it("Should allow authorized bot to end quiz anytime", async function () {
      const initialCreatorBalance = await owner.getBalance();
      const remainingBalance = await quizEscrow.getBalance();

      await expect(quizEscrow.connect(authorizedBot).endQuiz())
        .to.emit(quizEscrow, "QuizEnded")
        .to.emit(quizEscrow, "UnclaimedFundsReturned");

      expect(await quizEscrow.isEnded()).to.equal(true);
      expect(await quizEscrow.getBalance()).to.equal(0);

      // Check creator received remaining funds
      const finalCreatorBalance = await owner.getBalance();
      expect(finalCreatorBalance.sub(initialCreatorBalance)).to.equal(remainingBalance);
    });

    it("Should allow anyone to end quiz after 24 hours", async function () {
      // Fast forward 24 hours
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
      await ethers.provider.send("evm_mine");

      await expect(quizEscrow.connect(participant1).endQuiz())
        .to.emit(quizEscrow, "QuizEnded");

      expect(await quizEscrow.isEnded()).to.equal(true);
    });

    it("Should reject unauthorized early ending", async function () {
      await expect(quizEscrow.connect(participant1).endQuiz())
        .to.be.revertedWith("QuizEscrow: Quiz not expired and caller not authorized bot");

      await expect(quizEscrow.connect(owner).endQuiz())
        .to.be.revertedWith("QuizEscrow: Quiz not expired and caller not authorized bot");
    });

    it("Should reject ending already ended quiz", async function () {
      await quizEscrow.connect(authorizedBot).endQuiz();

      await expect(quizEscrow.connect(authorizedBot).endQuiz())
        .to.be.revertedWith("QuizEscrow: Quiz already ended");
    });

    it("Should prevent new participants after ending", async function () {
      await quizEscrow.connect(authorizedBot).endQuiz();

      await expect(
        quizEscrow.connect(authorizedBot).recordQuizResult(participant3.address, 1, 1)
      ).to.be.revertedWith("QuizEscrow: Quiz has ended");
    });
  });

  describe("Quiz expiry", function () {
    it("Should prevent new participants after 24 hours", async function () {
      // Fast forward 24 hours
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
      await ethers.provider.send("evm_mine");

      await expect(
        quizEscrow.connect(authorizedBot).recordQuizResult(participant1.address, 3, 1)
      ).to.be.revertedWith("QuizEscrow: Quiz has expired");
    });

    it("Should show correct remaining time", async function () {
      const remainingTime = await quizEscrow.getRemainingTime();
      expect(remainingTime).to.be.closeTo(ethers.BigNumber.from(24 * 60 * 60), 10);

      // Fast forward 12 hours
      await ethers.provider.send("evm_increaseTime", [12 * 60 * 60]);
      await ethers.provider.send("evm_mine");

      const remainingTimeAfter = await quizEscrow.getRemainingTime();
      expect(remainingTimeAfter).to.be.closeTo(ethers.BigNumber.from(12 * 60 * 60), 10);

      // Fast forward past expiry
      await ethers.provider.send("evm_increaseTime", [13 * 60 * 60]);
      await ethers.provider.send("evm_mine");

      expect(await quizEscrow.getRemainingTime()).to.equal(0);
    });
  });

  describe("View functions", function () {
    beforeEach(async function () {
      await quizEscrow.connect(authorizedBot).recordQuizResult(participant1.address, 3, 1);
      await quizEscrow.connect(authorizedBot).recordQuizResult(participant2.address, 2, 2);
    });

    it("Should return correct quiz stats", async function () {
      const stats = await quizEscrow.getQuizStats();
      
      expect(stats._totalParticipants).to.equal(2);
      expect(stats._totalCorrectAnswers).to.equal(5); // 3 + 2
      expect(stats._totalIncorrectAnswers).to.equal(3); // 1 + 2
      expect(stats._totalPaidOut).to.be.gt(0);
      expect(stats._remainingBalance).to.be.gt(0);
      expect(stats._isExpired).to.equal(false);
      expect(stats._isEnded).to.equal(false);
    });

    it("Should return correct participant results", async function () {
      const result1 = await quizEscrow.getParticipantResult(participant1.address);
      expect(result1.correctCount).to.equal(3);
      expect(result1.incorrectCount).to.equal(1);
      expect(result1.hasParticipated).to.equal(true);

      const result3 = await quizEscrow.getParticipantResult(participant3.address);
      expect(result3.hasParticipated).to.equal(false);
    });

    it("Should return all participants", async function () {
      const participants = await quizEscrow.getAllParticipants();
      expect(participants).to.have.lengthOf(2);
      expect(participants[0]).to.equal(participant1.address);
      expect(participants[1]).to.equal(participant2.address);
    });
  });

  describe("Edge cases", function () {
    it("Should handle zero reward scenarios", async function () {
      const zeroIncorrectQuiz = await QuizEscrow.deploy(
        owner.address,    // creator
        authorizedBot.address,
        correctReward,
        0, // Zero incorrect reward
        { value: fundingAmount }
      );

      await expect(
        zeroIncorrectQuiz.connect(authorizedBot).recordQuizResult(participant1.address, 3, 1)
      ).to.emit(zeroIncorrectQuiz, "QuizResultRecorded")
        .withArgs(participant1.address, 3, 1, correctReward.mul(3));
    });

    it("Should handle zero funding with zero rewards", async function () {
      const zeroEverythingQuiz = await QuizEscrow.deploy(
        owner.address,    // creator
        authorizedBot.address,
        0, // Zero correct reward
        0, // Zero incorrect reward
        { value: 0 } // Zero funding
      );

      // Should allow recording results with zero payout
      await expect(
        zeroEverythingQuiz.connect(authorizedBot).recordQuizResult(participant1.address, 3, 1)
      ).to.emit(zeroEverythingQuiz, "QuizResultRecorded")
        .withArgs(participant1.address, 3, 1, 0); // Zero payout

      // Verify participant data is still recorded
      const result = await zeroEverythingQuiz.getParticipantResult(participant1.address);
      expect(result.hasParticipated).to.equal(true);
      expect(result.correctCount).to.equal(3);
      expect(result.incorrectCount).to.equal(1);
    });

    it("Should handle exact funding scenarios", async function () {
      const exactFunding = correctReward.mul(2); // Exactly enough for 2 correct answers
      const exactQuiz = await QuizEscrow.deploy(
        owner.address,    // creator
        authorizedBot.address,
        correctReward,
        0,
        { value: exactFunding }
      );

      // Should work for exact amount
      await exactQuiz.connect(authorizedBot).recordQuizResult(participant1.address, 2, 0);
      
      // Should fail for more than available
      await expect(
        exactQuiz.connect(authorizedBot).recordQuizResult(participant2.address, 1, 0)
      ).to.be.revertedWith("QuizEscrow: Insufficient funds for payout");
    });

    it("Should handle mixed zero/non-zero reward configurations", async function () {
      // Zero correct rewards, non-zero incorrect rewards
      const zeroCorrectQuiz = await QuizEscrow.deploy(
        owner.address,
        authorizedBot.address,
        0, // Zero correct reward
        incorrectReward, // Non-zero incorrect reward
        { value: fundingAmount }
      );

      const expectedPayout = incorrectReward.mul(2); // Only incorrect answers count
      await expect(
        zeroCorrectQuiz.connect(authorizedBot).recordQuizResult(participant1.address, 3, 2)
      ).to.emit(zeroCorrectQuiz, "QuizResultRecorded")
        .withArgs(participant1.address, 3, 2, expectedPayout);
    });
  });
});
