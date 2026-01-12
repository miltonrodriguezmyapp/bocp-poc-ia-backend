// Versión simplificada temporal para deployment inicial
const { v4: uuidv4 } = require('uuid');

module.exports.bedrockSendPrompt = async (event) => {
  console.log('Event:', event);

  try {
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

    // Respuesta temporal de prueba
    const conversationId = uuidv4();
    const currentSessionId = sessionId || uuidv4();

    return {
      statusCode: 200,
      body: JSON.stringify({
        result: true,
        message: 'Función de Bedrock desplegada exitosamente (modo prueba)',
        records: {
          conversationId,
          sessionId: currentSessionId,
          prompt: prompt,
          response: 'Esta es una respuesta de prueba. La integración completa con Bedrock se activará después del deployment inicial.',
          files: [],
          timestamp: new Date().toISOString(),
          note: 'MODO PRUEBA - Actualizar a versión completa después del deployment'
        }
      })
    };
  } catch (err) {
    console.error('Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        result: false,
        message: 'Error: ' + err.message,
        error: err.toString()
      })
    };
  }
};
