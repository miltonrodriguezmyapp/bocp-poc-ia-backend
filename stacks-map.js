const ServerlessPluginSplitStacks = require('serverless-plugin-split-stacks');

const stacksMap = ServerlessPluginSplitStacks.stacksMap;

ServerlessPluginSplitStacks.resolveMigration = function (resource, logicalId, serverless) {

    if (logicalId.startsWith("Corporation") ||
        logicalId.startsWith("corporation")) {
        return { destination: 'Corporation' };
    }
    if (logicalId.startsWith("Role") ||
        logicalId.startsWith("role")) {
        return { destination: 'Role' };
    }
    if (logicalId.startsWith("User") ||
        logicalId.startsWith("user")) {
        return { destination: 'User' };
    }
    if (logicalId.startsWith("Notifications") ||
        logicalId.startsWith("notifications")) {
        return { destination: 'Notifications' };
    }
    if (logicalId.startsWith("Locations") ||
        logicalId.startsWith("locations")) {
        return { destination: 'Locations' };
    }
    // Temporalmente deshabilitado - Bedrock irá al stack principal
    // if (logicalId.startsWith("Bedrock") ||
    //     logicalId.startsWith("bedrock")) {
    //     return { destination: 'Bedrock' };
    // }

        //  //Deploy para DEV
         if (resource.Type == 'AWS::ApiGateway::Method' ||
         resource.Type == 'AWS::ApiGateway::Resource' ||
         resource.Type == 'AWS::ApiGateway::Deployment'
     ) {
             return { destination: 'ApisGS1APIEDI' };
     }

    return this.stacksMap[resource.Type];
};

