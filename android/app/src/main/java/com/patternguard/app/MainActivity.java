package com.patternguard.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        // Register PatternGuard native plugins before the bridge initialises.
        registerPlugin(OcrPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
