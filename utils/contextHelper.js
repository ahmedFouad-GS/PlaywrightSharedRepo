module.exports = {
    async switchToWebContext(driver) {
      const contexts = await driver.execute('getContexts');
      const webContext = contexts.find((ctx) => ctx.includes('WEBVIEW'));
      if (!webContext) throw new Error('Web context not found!');
      await driver.execute('setContext', [webContext]);
    },
  
    async switchToNativeContext(driver) {
      const contexts = await driver.execute('getContexts');
      const nativeContext = contexts.find((ctx) => ctx === 'NATIVE_APP');
      if (!nativeContext) throw new Error('Native context not found!');
      await driver.execute('setContext', [nativeContext]);
    },
  };
  