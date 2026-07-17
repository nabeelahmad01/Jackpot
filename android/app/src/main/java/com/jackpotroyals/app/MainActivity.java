package com.jackpotroyals.app;

import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.VideoView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private FrameLayout splashOverlay;
    private boolean splashDismissed = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        showSplashVideo();
    }

    private void showSplashVideo() {
        ViewGroup content = findViewById(android.R.id.content);
        if (content == null) {
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

        final VideoView videoView = new VideoView(this);
        FrameLayout.LayoutParams videoParams = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT,
            Gravity.CENTER
        );
        videoView.setLayoutParams(videoParams);

        Uri videoUri = Uri.parse("android.resource://" + getPackageName() + "/" + R.raw.jackpot_splash);
        videoView.setVideoURI(videoUri);
        videoView.setOnPreparedListener(mp -> {
            mp.setLooping(false);
            scaleVideoToFit(videoView, mp.getVideoWidth(), mp.getVideoHeight());
            videoView.start();
        });
        videoView.setOnCompletionListener(mp -> dismissSplash());
        videoView.setOnErrorListener((mp, what, extra) -> {
            dismissSplash();
            return true;
        });

        // Safety timeout if the video never starts/finishes.
        splashOverlay.postDelayed(this::dismissSplash, 12000);

        splashOverlay.addView(videoView);
        content.addView(splashOverlay);
    }

    /**
     * Fit the full landscape splash into the phone screen.
     * Uses contain-style scaling with a very light crop (~12%) so sides stay visible.
     */
    private void scaleVideoToFit(VideoView videoView, int videoWidth, int videoHeight) {
        if (videoWidth <= 0 || videoHeight <= 0 || splashOverlay == null) {
            return;
        }

        Runnable applyScale = () -> {
            int viewWidth = splashOverlay.getWidth();
            int viewHeight = splashOverlay.getHeight();
            if (viewWidth <= 0 || viewHeight <= 0) {
                return;
            }

            float widthRatio = (float) viewWidth / (float) videoWidth;
            float heightRatio = (float) viewHeight / (float) videoHeight;
            float containScale = Math.min(widthRatio, heightRatio);
            float coverScale = Math.max(widthRatio, heightRatio);
            // Keep almost the full frame visible; only a mild crop.
            float scale = containScale + (coverScale - containScale) * 0.12f;

            int scaledWidth = Math.round(videoWidth * scale);
            int scaledHeight = Math.round(videoHeight * scale);
            FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                scaledWidth,
                scaledHeight,
                Gravity.CENTER
            );
            videoView.setLayoutParams(params);
        };

        if (splashOverlay.getWidth() > 0 && splashOverlay.getHeight() > 0) {
            applyScale.run();
        } else {
            splashOverlay.post(applyScale);
        }
    }

    private void dismissSplash() {
        if (splashDismissed || splashOverlay == null) {
            return;
        }
        splashDismissed = true;

        ViewGroup parent = (ViewGroup) splashOverlay.getParent();
        if (parent != null) {
            parent.removeView(splashOverlay);
        }
        splashOverlay = null;
    }
}
