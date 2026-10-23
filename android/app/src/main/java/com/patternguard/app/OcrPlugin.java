package com.patternguard.app;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

/**
 * PatternGuard OCR Plugin
 *
 * Bridges the Capacitor WebView to Google ML Kit Text Recognition v2.
 * Called from JavaScript via Capacitor.Plugins.OcrPlugin.extractText().
 */
@CapacitorPlugin(name = "OcrPlugin")
public class OcrPlugin extends Plugin {

    @PluginMethod
    public void extractText(PluginCall call) {
        String imageBase64 = call.getString("imageBase64");
        if (imageBase64 == null || imageBase64.isEmpty()) {
            call.reject("imageBase64 is required and must not be empty");
            return;
        }

        byte[] imageBytes;
        try {
            imageBytes = Base64.decode(imageBase64, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("Failed to decode base64 image data: " + e.getMessage());
            return;
        }

        Bitmap bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.length);
        if (bitmap == null) {
            call.reject("Could not decode image. Supported formats: PNG, JPG, WEBP.");
            return;
        }

        Bitmap processedBitmap = scaleBitmapIfNeeded(bitmap, 1600);
        InputImage image = InputImage.fromBitmap(processedBitmap, 0);
        TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);

        recognizer.process(image)
            .addOnSuccessListener(visionText -> {
                JSObject ret = new JSObject();
                ret.put("text", visionText.getText());
                call.resolve(ret);
            })
            .addOnFailureListener(e -> {
                call.reject("ML Kit OCR failed: " + e.getMessage());
            });
    }

    private Bitmap scaleBitmapIfNeeded(Bitmap bitmap, int maxSide) {
        int w = bitmap.getWidth();
        int h = bitmap.getHeight();
        if (w <= maxSide && h <= maxSide) {
            return bitmap;
        }

        float scale = (float) maxSide / Math.max(w, h);
        int newW = Math.max(1, Math.round(w * scale));
        int newH = Math.max(1, Math.round(h * scale));
        return Bitmap.createScaledBitmap(bitmap, newW, newH, true);
    }
}
