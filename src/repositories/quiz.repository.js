/**
 * QuizRepository Interface
 * 
 * This defines the contract that any implementation (database or blockchain)
 * must adhere to. It's designed to allow easy swapping of storage mechanisms 
 * without affecting the rest of the application code.
 */
class IQuizRepository {
  async saveQuiz(quizData) { throw new Error('Method not implemented'); }
  async updateQuizFunding(quizId, fundingData) { throw new Error('Method not implemented'); }
  async getQuiz(id) { throw new Error('Method not implemented'); }
  async getQuizzes(filters) { throw new Error('Method not implemented'); }
  async saveQuestion(questionData) { throw new Error('Method not implemented'); }
  async getQuestions(quizId) { throw new Error('Method not implemented'); }
  async saveAnswer(answerData) { throw new Error('Method not implemented'); }
  async getAnswers(filters) { throw new Error('Method not implemented'); }
  async getLeaderboard(options) { throw new Error('Method not implemented'); }
  async getUserStats(userDiscordId) { throw new Error('Method not implemented'); }
}

/**
 * Database implementation of the Quiz Repository
 * This is the temporary implementation that stores quiz data in the SQLite database
 */
class DatabaseQuizRepository extends IQuizRepository {
  constructor(models) {
    super();
    this.models = models;
  }

  /**
   * Save a quiz to the database
   * @param {Object} quizData - Quiz data object
   * @returns {Promise<string>} - ID of the saved quiz
   */
  async saveQuiz(quizData) {
    try {
      const quiz = await this.models.Quiz.create({
        creatorDiscordId: quizData.creatorDiscordId,
        creatorWalletAddress: quizData.creatorWalletAddress || null,
        guildId: quizData.guildId || null,
        sourceUrl: quizData.sourceUrl,
        difficulty: quizData.difficulty,
        questionCount: quizData.questions ? quizData.questions.length : 0,
        tokenAddress: quizData.tokenAddress,
        chainId: quizData.chainId,
        rewardAmount: quizData.rewardAmount,
        fundingStatus: quizData.fundingStatus || 'unfunded',
        treasuryWalletAddress: quizData.treasuryWalletAddress || null,
        fundingTransactionHash: quizData.fundingTransactionHash || null,
        distributionTransactionHash: quizData.distributionTransactionHash || null,
        distributedAt: quizData.distributedAt || null,
        createdAt: new Date(),
        expiresAt: quizData.expiresAt,
        quizHash: quizData.quizHash || null
      });

      // If questions are provided, save them as well
      if (quizData.questions && Array.isArray(quizData.questions)) {
        console.log(`Saving ${quizData.questions.length} questions for quiz ${quiz.id}`);
        
        // Map each question to the database schema format
        const questionsToSave = quizData.questions.map((question, index) => {
          // Make sure questionText exists (required by the database)
          if (!question.questionText) {
            question.questionText = question.question || question.text || `Question ${index + 1}`;
          }
          
          // Log each question as we prepare it
          console.log(`Preparing question ${index} for database:`, {
            questionText: question.questionText,
            optionsCount: Array.isArray(question.options) ? question.options.length : 0,
            correctOptionIndex: question.correctOptionIndex
          });
          
          return {
            questionText: question.questionText,
            options: question.options || [],
            correctOptionIndex: question.correctOptionIndex !== undefined ? question.correctOptionIndex : 0,
            quizId: quiz.id,
            guildId: quizData.guildId || null,
            order: index
          };
        });
        
        // Save each question with proper error handling
        for (const q of questionsToSave) {
          try {
            const questionId = await this.saveQuestion(q);
            console.log(`Saved question with ID: ${questionId}`);
          } catch (error) {
            console.error(`Error saving question for quiz ${quiz.id}:`, error);
          }
        }
      } else {
        console.warn(`No questions to save for quiz ${quiz.id}`);
      }

      return quiz.id;
    } catch (error) {
      console.error('Error saving quiz:', error);
      throw error;
    }
  }

  /**
   * Update quiz funding status and related information
   * @param {string} quizId - Quiz ID
   * @param {Object} fundingData - Funding data to update
   * @returns {Promise<boolean>} - Success status
   */
  async updateQuizFunding(quizId, fundingData) {
    try {
      const quiz = await this.models.Quiz.findByPk(quizId);
      
      if (!quiz) {
        console.error(`Quiz with ID ${quizId} not found for funding update`);
        return false;
      }
      
      // Update funding-related fields
      await quiz.update({
        fundingStatus: fundingData.fundingStatus,
        treasuryWalletAddress: fundingData.treasuryWalletAddress,
        fundingTransactionHash: fundingData.fundingTransactionHash,
        // Only update distributionTransactionHash and distributedAt if they are provided
        ...(fundingData.distributionTransactionHash && { distributionTransactionHash: fundingData.distributionTransactionHash }),
        ...(fundingData.distributedAt && { distributedAt: fundingData.distributedAt })
      });
      
      return true;
    } catch (error) {
      console.error('Error updating quiz funding:', error);
      throw error;
    }
  }

  /**
   * Get a quiz by ID, including its questions
   * @param {string} id - Quiz ID
   * @returns {Promise<Object>} - Quiz data with questions
   */
  async getQuiz(id) {
    try {
      const quiz = await this.models.Quiz.findByPk(id, {
        include: [{
          model: this.models.Question,
          as: 'questions',
          order: [['order', 'ASC']]
        }]
      });

      if (!quiz) {
        return null;
      }

      return quiz.toJSON();
    } catch (error) {
      console.error('Error getting quiz:', error);
      throw error;
    }
  }

  /**
   * Get quizzes matching optional filters
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Array>} - Array of quizzes
   */
  async getQuizzes(filters = {}) {
    try {
      const where = {};
      
      if (filters.creatorDiscordId) {
        where.creatorDiscordId = filters.creatorDiscordId;
      }
      if (filters.guildId) {
        where.guildId = filters.guildId;
      }
      
      if (filters.active === true) {
        where.expiresAt = {
          [this.models.Sequelize.Op.gt]: new Date()
        };
      } else if (filters.active === false) {
        where.expiresAt = {
          [this.models.Sequelize.Op.lte]: new Date()
        };
      }

      const quizzes = await this.models.Quiz.findAll({
        where,
        order: [['createdAt', 'DESC']],
        limit: filters.limit || 100,
        offset: filters.offset || 0
      });

      return quizzes.map(quiz => quiz.toJSON());
    } catch (error) {
      console.error('Error getting quizzes:', error);
      throw error;
    }
  }

  /**
   * Save a question to the database
   * @param {Object} questionData - Question data object
   * @returns {Promise<string>} - ID of the saved question
   */
  async saveQuestion(questionData) {
    try {
      const question = await this.models.Question.create({
        quizId: questionData.quizId,
        guildId: questionData.guildId || null,
        questionText: questionData.questionText,
        correctOptionIndex: questionData.correctOptionIndex,
        options: questionData.options,
        order: questionData.order || 0
      });

      return question.id;
    } catch (error) {
      console.error('Error saving question:', error);
      throw error;
    }
  }

  /**
   * Get questions for a quiz
   * @param {string} quizId - Quiz ID
   * @returns {Promise<Array>} - Array of questions
   */
  async getQuestions(quizId) {
    try {
      const questions = await this.models.Question.findAll({
        where: { quizId },
        order: [['order', 'ASC']]
      });

      return questions.map(question => question.toJSON());
    } catch (error) {
      console.error('Error getting questions:', error);
      throw error;
    }
  }

  /**
   * Save an answer to the database
   * @param {Object} answerData - Answer data object
   * @returns {Promise<string>} - ID of the saved answer
   */
  async saveAnswer(answerData) {
    try {
      // Check if user has already answered this question
      const existingAnswer = await this.models.Answer.findOne({
        where: {
          questionId: answerData.questionId,
          userDiscordId: answerData.userDiscordId
        }
      });

      if (existingAnswer) {
        // Update existing answer
        await existingAnswer.update({
          selectedOptionIndex: answerData.selectedOptionIndex,
          isCorrect: answerData.isCorrect,
          answeredAt: new Date(),
          transactionHash: answerData.transactionHash || null
        });
        return existingAnswer.id;
      }

      // Create new answer
      const answer = await this.models.Answer.create({
        quizId: answerData.quizId,
        questionId: answerData.questionId,
        guildId: answerData.guildId || null,
        userDiscordId: answerData.userDiscordId,
        userWalletAddress: answerData.userWalletAddress || null,
        selectedOptionIndex: answerData.selectedOptionIndex,
        isCorrect: answerData.isCorrect,
        answeredAt: new Date(),
        transactionHash: answerData.transactionHash || null
      });

      return answer.id;
    } catch (error) {
      console.error('Error saving answer:', error);
      throw error;
    }
  }

  /**
   * Get answers matching optional filters
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Array>} - Array of answers
   */
  async getAnswers(filters = {}) {
    try {
      const where = {};
      
      if (filters.quizId) {
        where.quizId = filters.quizId;
      }
      
      if (filters.questionId) {
        where.questionId = filters.questionId;
      }
      
      if (filters.userDiscordId) {
        where.userDiscordId = filters.userDiscordId;
      }
      if (filters.guildId) {
        where.guildId = filters.guildId;
      }

      const answers = await this.models.Answer.findAll({
        where,
        order: [['answeredAt', 'DESC']],
        include: [
          {
            model: this.models.Question,
            as: 'question'
          }
        ],
        limit: filters.limit || 100,
        offset: filters.offset || 0
      });

      return answers.map(answer => answer.toJSON());
    } catch (error) {
      console.error('Error getting answers:', error);
      throw error;
    }
  }

  /**
   * Get leaderboard data
   * @param {Object} options - Leaderboard options
   * @returns {Promise<Array>} - Array of leaderboard entries
   */
  async getLeaderboard(options = {}) {
    try {
      const currentTime = new Date();
      const whereGuild = options.guildId ? 'WHERE quizzes.guildId = :guildId' : '';
      
      // Using raw SQL query with Sequelize to get participation stats for ALL quizzes
      // but only score metrics for expired quizzes
      const [leaderboardEntries] = await this.models.sequelize.query(`
        SELECT 
          answers.userDiscordId,
          answers.userWalletAddress,
          -- Only count correct answers from expired quizzes
          SUM(CASE WHEN quizzes.expiresAt < :currentTime AND answers.isCorrect = 1 THEN 1 ELSE 0 END) as correctAnswers,
          -- Only count questions from expired quizzes for scoring
          COUNT(DISTINCT CASE WHEN quizzes.expiresAt < :currentTime THEN answers.questionId ELSE NULL END) as totalAnswered,
          -- Accuracy based only on expired quizzes
          (CASE 
            WHEN COUNT(DISTINCT CASE WHEN quizzes.expiresAt < :currentTime THEN answers.id ELSE NULL END) > 0 
            THEN SUM(CASE WHEN quizzes.expiresAt < :currentTime AND answers.isCorrect = 1 THEN 1 ELSE 0 END) * 100.0 / 
                 COUNT(DISTINCT CASE WHEN quizzes.expiresAt < :currentTime THEN answers.id ELSE NULL END) 
            ELSE 0 
          END) as accuracy,
          -- Total quizzes taken (including both expired and active)
          COUNT(DISTINCT answers.quizId) as quizzesTaken,
          -- Quizzes that have expired
          COUNT(DISTINCT 
            CASE WHEN quizzes.expiresAt < :currentTime THEN answers.quizId ELSE NULL END
          ) as expiredQuizzesTaken,
          -- Quizzes that are still active
          COUNT(DISTINCT 
            CASE WHEN quizzes.expiresAt >= :currentTime THEN answers.quizId ELSE NULL END
          ) as activeQuizzesTaken,
          MAX(answers.answeredAt) as lastActive
        FROM answers
        JOIN quizzes ON answers.quizId = quizzes.id
        ${whereGuild}
        GROUP BY answers.userDiscordId, answers.userWalletAddress
        ORDER BY ${options.orderBy || 'correctAnswers'} DESC
        LIMIT ${options.limit || 20}
        OFFSET ${options.offset || 0}
      `, {
        replacements: { currentTime, guildId: options.guildId }
      });

      return leaderboardEntries;
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      throw error;
    }
  }

  /**
   * Get stats for a specific user
   * @param {string} userDiscordId - Discord user ID
   * @returns {Promise<Object>} - User stats
   */
  async getUserStats(userDiscordId, options = {}) {
    try {
      const currentTime = new Date();
      const andGuild = options.guildId ? ' AND quizzes.guildId = :guildId' : '';
      
      // Using raw SQL query with Sequelize to get user stats
      // Show participation for all quizzes but scores only for expired ones
      const [userStats] = await this.models.sequelize.query(`
        SELECT 
          answers.userDiscordId,
          answers.userWalletAddress,
          -- Only count correct answers from expired quizzes
          SUM(CASE WHEN quizzes.expiresAt < :currentTime AND answers.isCorrect = 1 THEN 1 ELSE 0 END) as correctAnswers,
          -- Only count questions from expired quizzes for scoring
          COUNT(DISTINCT CASE WHEN quizzes.expiresAt < :currentTime THEN answers.questionId ELSE NULL END) as totalAnswered,
          -- Accuracy based only on expired quizzes
          (CASE 
            WHEN COUNT(DISTINCT CASE WHEN quizzes.expiresAt < :currentTime THEN answers.id ELSE NULL END) > 0 
            THEN SUM(CASE WHEN quizzes.expiresAt < :currentTime AND answers.isCorrect = 1 THEN 1 ELSE 0 END) * 100.0 / 
                 COUNT(DISTINCT CASE WHEN quizzes.expiresAt < :currentTime THEN answers.id ELSE NULL END) 
            ELSE 0 
          END) as accuracy,
          -- Total quizzes taken (including both expired and active)
          COUNT(DISTINCT answers.quizId) as quizzesTaken,
          -- Quizzes that have expired
          COUNT(DISTINCT 
            CASE WHEN quizzes.expiresAt < :currentTime THEN answers.quizId ELSE NULL END
          ) as expiredQuizzesTaken,
          -- Quizzes that are still active
          COUNT(DISTINCT 
            CASE WHEN quizzes.expiresAt >= :currentTime THEN answers.quizId ELSE NULL END
          ) as activeQuizzesTaken,
          MAX(answers.answeredAt) as lastActive
        FROM answers
        JOIN quizzes ON answers.quizId = quizzes.id
        WHERE answers.userDiscordId = :userDiscordId${andGuild}
        GROUP BY answers.userDiscordId
      `, {
        replacements: { userDiscordId, currentTime, guildId: options.guildId }
      });

      return userStats && userStats[0] ? userStats[0] : null;
    } catch (error) {
      console.error('Error getting user stats:', error);
      throw error;
    }
  }
}

/**
 * Factory function to create a quiz repository
 * @param {Object} options - Options including models
 * @returns {IQuizRepository} - Quiz repository instance
 */
function createQuizRepository(options = {}) {
  // For now, we always return the database implementation
  // In the future, we'll switch to blockchain implementation
  return new DatabaseQuizRepository(options.models);
}

module.exports = {
  IQuizRepository,
  DatabaseQuizRepository,
  createQuizRepository
};
