"use client";

import React, { useEffect } from "react";
import { useRedStore } from "../store/useRedStore";

export default function Toast() {
  const { notification, clearNotification } = useRedStore();

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        clearNotification();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification, clearNotification]);

  if (!notification) return null;

  return (
    <div className="toast-container animate-slide-in" onClick={clearNotification}>
      <div className="toast glass">
        <div className="toast-icon">💬</div>
        <div className="toast-content">
          <span className="toast-title">{notification.title}</span>
          <p className="toast-message">{notification.message}</p>
        </div>
      </div>

    </div>
  );
}
