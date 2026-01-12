const mysql2Connection = require('../../../config/db_' + process.env.stage);
const mysql = require('mysql2/promise');

module.exports.bedrockGetHistory = async (event) => {
  console.log('Event:', event);

  const params = event.queryStringParameters || {};
  const { sessionId, userId, limit = 50, offset = 0 } = params;

  if (!sessionId && !userId) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        result: false,
        message: "Se requiere al menos sessionId o userId"
      }),
    };
  }

  return await getHistory({
    sessionId,
    userId,
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
};

async function getHistory(params) {
  const connection = await mysql.createConnection(mysql2Connection.options);

  try {
    let whereClause = 'WHERE bedrockConversationDeleted IS NULL';
    
    if (params.sessionId) {
      whereClause += ` AND bedrockConversationSessionId = '${params.sessionId}'`;
    }
    
    if (params.userId) {
      whereClause += ` AND bedrockConversationUserId = '${params.userId}'`;
    }

    const query = `
      SELECT 
        bedrockConversationId,
        bedrockConversationSessionId,
        bedrockConversationUserId,
        bedrockConversationPrompt,
        bedrockConversationResponse,
        bedrockConversationAgentId,
        bedrockConversationFileIds,
        bedrockConversationCreationDate
      FROM bedrock_conversations
      ${whereClause}
      ORDER BY bedrockConversationCreationDate DESC
      LIMIT ${params.limit}
      OFFSET ${params.offset}
    `;

    const [conversations] = await connection.query(query);

    // Contar total de conversaciones
    const countQuery = `
      SELECT COUNT(*) as total
      FROM bedrock_conversations
      ${whereClause}
    `;
    
    const [countResult] = await connection.query(countQuery);
    const total = countResult[0].total;

    await connection.end();

    // Formatear las conversaciones
    const formattedConversations = conversations.map(conv => ({
      conversationId: conv.bedrockConversationId,
      sessionId: conv.bedrockConversationSessionId,
      userId: conv.bedrockConversationUserId,
      prompt: conv.bedrockConversationPrompt,
      response: conv.bedrockConversationResponse,
      agentId: conv.bedrockConversationAgentId,
      fileIds: conv.bedrockConversationFileIds ? JSON.parse(conv.bedrockConversationFileIds) : [],
      createdAt: conv.bedrockConversationCreationDate
    }));

    const results = JSON.stringify({
      statusCode: 200,
      result: true,
      message: 'Historial obtenido exitosamente.',
      records: formattedConversations,
      pagination: {
        total,
        limit: params.limit,
        offset: params.offset,
        hasMore: (params.offset + params.limit) < total
      }
    });

    return results;
  } catch (err) {
    console.error('Error al obtener historial:', err);
    await connection.end();
    
    return JSON.stringify({
      statusCode: 500,
      result: false,
      message: 'Error al obtener historial: ' + err.message,
      error: err.toString()
    });
  }
}
