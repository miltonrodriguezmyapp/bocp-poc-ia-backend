'use strict';

exports.handler = async (event) => {
  console.log("Event from Bedrock Agent:", JSON.stringify(event, null, 2));

  // Ejemplo de extracción de un parámetro (ajusta según los que definas en el Action Group)
  const userInput = event.parameters?.fileUrl || "No se recibió parámetro";

  return {
    messageVersion: "1.0",
    response: {
      actionGroup: event.actionGroup,
      function: event.function,
      output: {
        text: `Extractor funcionando correctamente. Parámetro recibido: ${userInput}`
      }
    }
  };
};
