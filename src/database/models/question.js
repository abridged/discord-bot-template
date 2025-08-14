const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Question extends Model {
    static associate(models) {
      // define associations here
      Question.belongsTo(models.Quiz, {
        foreignKey: 'quizId',
        as: 'quiz'
      });
      
      Question.hasMany(models.Answer, {
        foreignKey: 'questionId',
        as: 'answers',
        onDelete: 'CASCADE'
      });
    }
  }
  
  Question.init({
    guildId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Discord guild/server ID for multi-tenant segregation'
    },
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    quizId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'quizzes',
        key: 'id'
      }
    },
    questionText: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    correctOptionIndex: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    options: {
      type: DataTypes.JSON, // Storing answer options as JSON array
      allowNull: false
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'Question',
    tableName: 'questions',
    timestamps: true,
    indexes: [
      { fields: ['guildId'] }
    ]
  });
  
  return Question;
};
