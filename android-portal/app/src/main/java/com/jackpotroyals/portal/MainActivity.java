package com.jackpotroyals.portal;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.util.DisplayMetrics;
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

        View decor = getWindow() != null ? getWindow().getDecorView() : null;
        if (decor != null) {
            decor.post(this::finishNativeChromeSetup);
            decor.postDelayed(this::finishNativeChromeSetup, 400);
            decor.postDelayed(this::finishNativeChromeSetup, 1200);
        }
    }

    private void finishNativeChromeSetup() {
        applySolidSystemBars();
        lockWebViewZoom();
        bindStatusBarCssVar();
    }

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
        String ua = settings.getUserAgentString();
        if (ua != null && !ua.contains("JackpotPortalNative")) {
            settings.setUserAgentString(ua + " JackpotPortalNative/1.2");
        } else if (ua != null && ua.matches(".*JackpotPortalNative/\\d+\\.\\d+.*")) {
            settings.setUserAgentString(
                ua.replaceAll("JackpotPortalNative/\\d+\\.\\d+", "JackpotPortalNative/1.2")
            );
        }
    }

    /**
     * WebView padding/margin does not reliably move position:fixed HTML out from
     * under the status bar. Push the real status-bar height into --admin-sat so
     * the admin header CSS can sit below battery / wifi / signal icons.
     */
    private void bindStatusBarCssVar() {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) {
            return;
        }

        injectAdminSafeAreaCss(cssPxFromDevicePx(statusBarFallbackPx()));

        ViewCompat.setOnApplyWindowInsetsListener(webView, (v, windowInsets) -> {
            Insets bars = windowInsets.getInsets(
                WindowInsetsCompat.Type.statusBars() | WindowInsetsCompat.Type.displayCutout()
            );
            int topPx = bars.top > 0 ? bars.top : statusBarFallbackPx();
            injectAdminSafeAreaCss(cssPxFromDevicePx(topPx));
            return windowInsets;
        });
        ViewCompat.requestApplyInsets(webView);
    }

    private void injectAdminSafeAreaCss(int cssTop) {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) {
            return;
        }
        int safe = Math.max(cssTop, 40);
        String js =
            "(function(){"
                + "var r=document.documentElement;"
                + "r.classList.add('admin-native-shell');"
                + "r.style.setProperty('--admin-sat','"
                + safe
                + "px');"
                + "})();";
        webView.evaluateJavascript(js, null);
    }

    private int statusBarFallbackPx() {
        int resId = getResources().getIdentifier("status_bar_height", "dimen", "android");
        if (resId > 0) {
            return getResources().getDimensionPixelSize(resId);
        }
        DisplayMetrics metrics = getResources().getDisplayMetrics();
        return Math.round(24 * metrics.density);
    }

    private int cssPxFromDevicePx(int devicePx) {
        float density = getResources().getDisplayMetrics().density;
        if (density <= 0f) {
            return Math.max(40, devicePx);
        }
        return Math.max(40, Math.round(devicePx / density));
    }

    private void applySolidSystemBars() {
        Window window = getWindow();
        if (window == null) {
            return;
        }

        int barColor = Color.parseColor("#080a11");
        WindowCompat.setDecorFitsSystemWindows(window, true);
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(barColor);
        window.setNavigationBarColor(barColor);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setStatusBarContrastEnforced(true);
            window.setNavigationBarContrastEnforced(true);
        }

        View decor = window.getDecorView();
        decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(window, decor);
        controller.setAppearanceLightStatusBars(false);
        controller.setAppearanceLightNavigationBars(false);
        controller.show(WindowInsetsCompat.Type.statusBars());
        controller.show(WindowInsetsCompat.Type.navigationBars());
    }
}
