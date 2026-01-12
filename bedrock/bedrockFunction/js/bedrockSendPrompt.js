const mysql2Connection = require('../../../config/db_' + process.env.stage);
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

// Lazy load del cliente de Bedrock para evitar errores de inicialización
let BedrockAgentRuntimeClient, InvokeAgentCommand, bedrockClient;

function initBedrockClient() {
  if (!bedrockClient) {
    try {
      const bedrock = require('@aws-sdk/client-bedrock-agent-runtime');
      BedrockAgentRuntimeClient = bedrock.BedrockAgentRuntimeClient;
      InvokeAgentCommand = bedrock.InvokeAgentCommand;
      
      // AWS_REGION está disponible automáticamente en Lambda
      bedrockClient = new BedrockAgentRuntimeClient({
        region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1'
      });
    } catch (error) {
      console.error('Error al cargar cliente de Bedrock:', error);
      throw new Error('Bedrock client no disponible: ' + error.message);
    }
  }
  return bedrockClient;
}

module.exports.bedrockSendPrompt = async (event) => {
  console.log('Event:', event);

  let body;
  if (typeof event.body === 'string') {
    body = JSON.parse(event.body);
  } else {
    body = event.body;
  }

  const { prompt, userId, sessionId, fileIds, agentId, agentAliasId } = body;

  if (!prompt || !userId || !agentId || !agentAliasId) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        result: false,
        message: "Faltan campos requeridos: prompt, userId, agentId, agentAliasId"
      }),
    };
  }

  // Generar o usar sessionId existente
  const currentSessionId = sessionId || uuidv4();

  return await transaction({
    prompt,
    userId,
    sessionId: currentSessionId,
    fileIds: fileIds || [],
    agentId,
    agentAliasId
  });
};

async function transaction(params) {
  // Comentado temporalmente - sin interacción con base de datos
  // const connection = await mysql.createConnection(mysql2Connection.options);

  try {
    // await connection.beginTransaction();

    // ===== COMENTADO: Obtener información de archivos desde BD =====
    let fileContexts = [];
    
    // if (params.fileIds && params.fileIds.length > 0) {
    //   const fileIdsString = params.fileIds.map(id => `'${id}'`).join(',');
    //   const fileQuery = `
    //     SELECT 
    //       bedrockFileId,
    //       bedrockFileS3Key,
    //       bedrockFileS3Url,
    //       bedrockFileName,
    //       bedrockFileType
    //     FROM bedrock_files
    //     WHERE bedrockFileId IN (${fileIdsString})
    //     AND bedrockFileDeleted IS NULL
    //     ORDER BY bedrockFileCreationDate DESC
    //   `;
    //   const [files] = await connection.query(fileQuery);
    //   fileContexts = files;
    // } else {
    //   let fileQuery;
    //   if (params.sessionId) {
    //     fileQuery = `
    //       SELECT 
    //         bedrockFileId,
    //         bedrockFileS3Key,
    //         bedrockFileS3Url,
    //         bedrockFileName,
    //         bedrockFileType
    //       FROM bedrock_files
    //       WHERE bedrockFileUserId = '${params.userId}'
    //       AND bedrockFileSessionId = '${params.sessionId}'
    //       AND bedrockFileDeleted IS NULL
    //       ORDER BY bedrockFileCreationDate DESC
    //       LIMIT 10
    //     `;
    //   } else {
    //     fileQuery = `
    //       SELECT 
    //         bedrockFileId,
    //         bedrockFileS3Key,
    //         bedrockFileS3Url,
    //         bedrockFileName,
    //         bedrockFileType
    //       FROM bedrock_files
    //       WHERE bedrockFileUserId = '${params.userId}'
    //       AND bedrockFileDeleted IS NULL
    //       ORDER BY bedrockFileCreationDate DESC
    //       LIMIT 10
    //     `;
    //   }
    //   const [files] = await connection.query(fileQuery);
    //   fileContexts = files;
    // }
    // ===== FIN COMENTADO =====

    // Preparar el input para Bedrock
    let enhancedPrompt = params.prompt;
    let contextInfo = '';
    
    if (fileContexts.length > 0) {
      const fileInfo = fileContexts.map(f => 
        `- ${f.bedrockFileName} (${f.bedrockFileS3Key})`
      ).join('\n');
      
      if (params.fileIds && params.fileIds.length > 0) {
        contextInfo = `\n\n[Archivos específicos proporcionados para análisis]\n${fileInfo}`;
      } else {
        contextInfo = `\n\n[Archivos recientes del usuario disponibles para consulta]\n${fileInfo}`;
      }
      
      enhancedPrompt = `${params.prompt}${contextInfo}`;
    }

    // Invocar el agente de Bedrock
    const client = initBedrockClient();
    
    const command = new InvokeAgentCommand({
      agentId: params.agentId,
      agentAliasId: params.agentAliasId,
      sessionId: params.sessionId,
      inputText: enhancedPrompt
    });

    console.log('Invocando agente de Bedrock con comando:', {
      agentId: params.agentId,
      agentAliasId: params.agentAliasId,
      sessionId: params.sessionId
    });
    
    const bedrockResponse = await client.send(command);
    
    // Procesar la respuesta del agente (streaming)
    let agentResponse = '';
    if (bedrockResponse.completion) {
      // Leer el stream de respuesta
      const chunks = [];
      for await (const chunk of bedrockResponse.completion) {
        if (chunk.chunk && chunk.chunk.bytes) {
          const text = new TextDecoder('utf-8').decode(chunk.chunk.bytes);
          chunks.push(text);
        }
      }
      agentResponse = chunks.join('');
    }

    // ===== COMENTADO: Guardar la interacción en la base de datos =====
    const conversationId = uuidv4();
    
    // const usedFileIds = fileContexts.map(f => f.bedrockFileId);
    // const insertQuery = `
    //   INSERT INTO bedrock_conversations (
    //     bedrockConversationId,
    //     bedrockConversationSessionId,
    //     bedrockConversationUserId,
    //     bedrockConversationPrompt,
    //     bedrockConversationResponse,
    //     bedrockConversationAgentId,
    //     bedrockConversationFileIds,
    //     bedrockConversationCreationDate
    //   ) VALUES (
    //     '${conversationId}',
    //     '${params.sessionId}',
    //     '${params.userId}',
    //     '${params.prompt.replace(/'/g, "''")}',
    //     '${agentResponse.replace(/'/g, "''")}',
    //     '${params.agentId}',
    //     ${usedFileIds.length > 0 ? `'${JSON.stringify(usedFileIds)}'` : 'NULL'},
    //     NOW()
    //   )
    // `;
    // await connection.query(insertQuery);
    // await connection.commit();
    // await connection.end();
    // ===== FIN COMENTADO =====

    const results = JSON.stringify({
      statusCode: 200,
      result: true,
      message: 'Prompt procesado exitosamente (sin persistencia BD).',
      records: {
        conversationId,
        sessionId: params.sessionId,
        prompt: params.prompt,
        response: agentResponse,
        files: fileContexts,
        timestamp: new Date().toISOString()
      },
    });

    return results;
  } catch (err) {
    console.error('Error en transaction:', err);
    // await connection.rollback();
    // await connection.end();
    
    return JSON.stringify({
      statusCode: 500,
      result: false,
      message: 'Error al procesar el prompt: ' + err.message,
      error: err.toString()
    });
  }
}
