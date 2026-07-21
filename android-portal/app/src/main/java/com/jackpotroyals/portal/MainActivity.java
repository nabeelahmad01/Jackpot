package com.jackpotroyals.portal;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applySolidSystemBars();

        // Bridge WebView is ready after layout — re-apply bars + insets so the
        // admin header never draws under the battery / signal status bar.
        View decor = getWindow() != null ? getWindow().getDecorView() : null;
        if (decor != null) {
            decor.post(this::finishNativeChromeSetup);
            decor.postDelayed(this::finishNativeChromeSetup, 400);
        }
    }

    private void finishNativeChromeSetup() {
        applySolidSystemBars();
        lockWebViewZoom();
        applyWebViewSystemBarPadding();
    }

    /**
     * Keep the app rendering at a consistent 100% on every device. Without this,
     * phones with a larger "Font size" / "Display size" accessibility setting make
     * the WebView zoom in, so the app looks bigger on some devices than others.
     */
    private void lockWebViewZoom() {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) {
            return;
        }
        WebSettings settings = webView.getSettings();
        settings.setTextZoom(100);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        // Guarantee Portal UA even if capacitor appendUserAgent is slow/missing,
        // so the live site can apply admin-native-shell CSS only for this APK.
        String ua = settings.getUserAgentString();
        if (ua != null && !ua.contains("JackpotPortalNative")) {
            settings.setUserAgentString(ua + " JackpotPortalNative/1.1");
        } else if (ua != null && ua.contains("JackpotPortalNative/1.0")) {
            settings.setUserAgentString(ua.replace("JackpotPortalNative/1.0", "JackpotPortalNative/1.1"));
        }
    }

    /**
     * Android 14/15 edge-to-edge often lets the WebView draw under the status bar
     * even when CSS safe-area is 0. Pad the WebView by the real system bar insets
     * so "JACKPOT ROYALS" header sits fully below battery/wifi/signal icons.
     */
    private void applyWebViewSystemBarPadding() {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) {
            return;
        }

        ViewCompat.setOnApplyWindowInsetsListener(webView, (v, windowInsets) -> {
            Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return windowInsets;
        });
        ViewCompat.requestApplyInsets(webView);
    }

    private void applySolidSystemBars() {
        Window window = getWindow();
        if (window == null) {
            return;
        }

        int barColor = Color.parseColor("#080a11");
        // Content must NOT draw under the status bar (header was hiding behind it).
        WindowCompat.setDecorFitsSystemWindows(window, true);
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(barColor);
        window.setNavigationBarColor(barColor);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setStatusBarContrastEnforced(true);
            window.setNavigationBarContrastEnforced(true);
        }

        View decor = window.getDecorView();
        WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(window, decor);
        controller.setAppearanceLightStatusBars(false);
        controller.setAppearanceLightNavigationBars(false);
    }
}
