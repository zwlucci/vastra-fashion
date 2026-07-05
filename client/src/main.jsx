import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { CartProvider } from "./context/CartContext.jsx";
import { NotificationProvider } from "./context/NotificationContext.jsx";
import { MessageProvider } from "./context/MessageContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { WishlistProvider } from "./context/WishlistContext.jsx";
import { AppErrorBoundary } from "./components/AppErrorBoundary.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <MessageProvider>
              <NotificationProvider>
                <CartProvider>
                  <WishlistProvider>
                    <App />
                  </WishlistProvider>
                </CartProvider>
              </NotificationProvider>
            </MessageProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>
);
