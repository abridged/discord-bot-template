'use strict';

require('dotenv').config();

async function run() {
  const mainDb = require('../src/database');
  const { setupModels } = require('../src/quizDatabase');

  console.log('Starting guildId backfill...');

  // Backfill quizzes/questions/answers from main DB based on heuristic:
  // If a quiz has no guildId, try to infer from any answer records for that quiz that might have guildId set later.
  const quizzes = await mainDb.Quiz.findAll();
  for (const quiz of quizzes) {
    if (!quiz.guildId) {
      try {
        const anyAnswer = await mainDb.Answer.findOne({ where: { quizId: quiz.id, guildId: { [mainDb.Sequelize.Op.ne]: null } } });
        const inferredGuildId = anyAnswer ? anyAnswer.guildId : null;
        await quiz.update({ guildId: inferredGuildId });
        await mainDb.Question.update({ guildId: inferredGuildId }, { where: { quizId: quiz.id } });
        await mainDb.Answer.update({ guildId: inferredGuildId }, { where: { quizId: quiz.id } });
        console.log(`Quiz ${quiz.id} backfilled guildId=${inferredGuildId || 'null'}`);
      } catch (e) {
        console.error('Backfill error for quiz', quiz.id, e.message);
      }
    }
  }

  // Backfill quiz tracking DB
  const quizDb = await setupModels();
  const completions = await quizDb.QuizCompletion.findAll();
  for (const c of completions) {
    if (!c.guildId) {
      try {
        // Infer from attempts if possible
        const attempt = await quizDb.QuizAttempt.findOne({ where: { userId: c.userId, quizId: c.quizId, guildId: { [quizDb.Sequelize.Op.ne]: null } } });
        const inferredGuildId = attempt ? attempt.guildId : null;
        await c.update({ guildId: inferredGuildId });
        await quizDb.QuizAnswer.update({ guildId: inferredGuildId }, { where: { completionId: c.id } });
        console.log(`Completion ${c.id} backfilled guildId=${inferredGuildId || 'null'}`);
      } catch (e) {
        console.error('Backfill error for completion', c.id, e.message);
      }
    }
  }

  console.log('guildId backfill complete.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});


