package com.jackpotroyals.app;

import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.SurfaceTexture;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.Surface;
import android.view.TextureView;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebView;
import android.widget.FrameLayout;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Plays the launch splash with TextureView (not VideoView/SurfaceView) so it does not
 * fight Capacitor's WebView and crash on mid-range Android devices.
 */
public class MainActivity extends BridgeActivity {
    private FrameLayout splashOverlay;
    private TextureView splashTexture;
    private MediaPlayer splashPlayer;
    private Surface splashSurface;
    private boolean splashDismissed = false;
    private final Runnable splashTimeout = this::dismissSplash;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applySolidSystemBars();
        pauseWebViewForSplash();
        showSplashVideo();
    }

    @Override
    public void onDestroy() {
        releaseSplashPlayer();
        super.onDestroy();
    }

    private void applySolidSystemBars() {
        Window window = getWindow();
        if (window == null) {
            return;
        }

        int barColor = Color.parseColor("#080a11");
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

    private void pauseWebViewForSplash() {
        try {
            if (getBridge() == null || getBridge().getWebView() == null) {
                return;
            }
            WebView webView = getBridge().getWebView();
            webView.onPause();
            webView.pauseTimers();
        } catch (Exception ignored) {
            // Keep launch resilient.
        }
    }

    private void resumeWebViewAfterSplash() {
        try {
            if (getBridge() == null || getBridge().getWebView() == null) {
                return;
            }
            WebView webView = getBridge().getWebView();
            webView.resumeTimers();
            webView.onResume();
        } catch (Exception ignored) {
            // Keep launch resilient.
        }
    }

    private void showSplashVideo() {
        try {
            ViewGroup content = findViewById(android.R.id.content);
            if (content == null) {
                resumeWebViewAfterSplash();
                return;
            }

            splashOverlay = new FrameLayout(this);
            splashOverlay.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            ));
            splashOverlay.setBackgroundColor(Color.parseColor("#080a11"));
            splashOverlay.setClickable(true);
            splashOverlay.setFocusable(true);
            splashOverlay.setElevation(100f);

            splashTexture = new TextureView(this);
            splashTexture.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
                Gravity.CENTER
            ));

            splashTexture.setSurfaceTextureListener(new TextureView.SurfaceTextureListener() {
                @Override
                public void onSurfaceTextureAvailable(SurfaceTexture surface, int width, int height) {
                    startSplashPlayer(surface);
                }

                @Override
                public void onSurfaceTextureSizeChanged(SurfaceTexture surface, int width, int height) {
                    // no-op
                }

                @Override
                public boolean onSurfaceTextureDestroyed(SurfaceTexture surface) {
                    releaseSplashPlayer();
                    return true;
                }

                @Override
                public void onSurfaceTextureUpdated(SurfaceTexture surface) {
                    // no-op
                }
            });

            splashOverlay.addView(splashTexture);
            content.addView(splashOverlay);
            splashOverlay.postDelayed(splashTimeout, 10000);
        } catch (Exception e) {
            dismissSplash();
        }
    }

    private void startSplashPlayer(SurfaceTexture surfaceTexture) {
        if (splashDismissed) {
            return;
        }

        try {
            releaseSplashPlayer();
            splashSurface = new Surface(surfaceTexture);
            splashPlayer = new MediaPlayer();
            splashPlayer.setSurface(splashSurface);

            Uri videoUri = Uri.parse("android.resource://" + getPackageName() + "/" + R.raw.jackpot_splash);
            splashPlayer.setDataSource(this, videoUri);
            splashPlayer.setOnPreparedListener(mp -> {
                try {
                    applyContainTransform(mp.getVideoWidth(), mp.getVideoHeight());
                    mp.setLooping(false);
                    mp.start();
                } catch (Exception e) {
                    dismissSplash();
                }
            });
            splashPlayer.setOnCompletionListener(mp -> dismissSplash());
            splashPlayer.setOnErrorListener((mp, what, extra) -> {
                dismissSplash();
                return true;
            });
            splashPlayer.prepareAsync();
        } catch (Exception e) {
            dismissSplash();
        }
    }

    /** Letterbox the landscape splash so sides are not heavily cropped. */
    private void applyContainTransform(int videoWidth, int videoHeight) {
        if (splashTexture == null || videoWidth <= 0 || videoHeight <= 0) {
            return;
        }

        int viewWidth = splashTexture.getWidth();
        int viewHeight = splashTexture.getHeight();
        if (viewWidth <= 0 || viewHeight <= 0) {
            splashTexture.post(() -> applyContainTransform(videoWidth, videoHeight));
            return;
        }

        float scale = Math.min(
            (float) viewWidth / (float) videoWidth,
            (float) viewHeight / (float) videoHeight
        );
        // Mild zoom so the frame fills a bit more without hard side crop.
        scale = scale * 1.06f;

        float scaledWidth = videoWidth * scale;
        float scaledHeight = videoHeight * scale;
        float dx = (viewWidth - scaledWidth) / 2f;
        float dy = (viewHeight - scaledHeight) / 2f;

        Matrix matrix = new Matrix();
        matrix.setScale(scale, scale);
        matrix.postTranslate(dx, dy);
        splashTexture.setTransform(matrix);
    }

    private void dismissSplash() {
        if (splashDismissed) {
            return;
        }
        splashDismissed = true;

        try {
            if (splashOverlay != null) {
                splashOverlay.removeCallbacks(splashTimeout);
            }
        } catch (Exception ignored) {
        }

        releaseSplashPlayer();

        try {
            if (splashOverlay != null) {
                ViewGroup parent = (ViewGroup) splashOverlay.getParent();
                if (parent != null) {
                    parent.removeView(splashOverlay);
                }
            }
        } catch (Exception ignored) {
        }

        splashOverlay = null;
        splashTexture = null;
        resumeWebViewAfterSplash();
    }

    private void releaseSplashPlayer() {
        try {
            if (splashPlayer != null) {
                try {
                    if (splashPlayer.isPlaying()) {
                        splashPlayer.stop();
                    }
                } catch (Exception ignored) {
                }
                splashPlayer.reset();
                splashPlayer.release();
            }
        } catch (Exception ignored) {
        } finally {
            splashPlayer = null;
        }

        try {
            if (splashSurface != null) {
                splashSurface.release();
            }
        } catch (Exception ignored) {
        } finally {
            splashSurface = null;
        }
    }
}
