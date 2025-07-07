import React, { useState } from "react";
import { auth } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "firebase/auth";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        alert("✅ Login successful!");
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        alert("✅ Account created successfully!");
      }
    } catch (err) {
      alert("❌ " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <img src="/logo.png" alt="Logo" style={styles.logo} />
        <h2 style={styles.title}>{isLogin ? "Login" : "Sign Up"}</h2>
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={styles.input}
          />
          <button type="submit" disabled={loading} style={styles.submitBtn}>
            {loading ? "Please wait..." : isLogin ? "Login" : "Sign Up"}
          </button>
        </form>
        <button onClick={() => setIsLogin(!isLogin)} style={styles.toggleBtn}>
          {isLogin
            ? "New here? Create an account"
            : "Already registered? Login"}
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #1c2541, #3a506b)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "30px"
  },
  card: {
    width: "100%",
    maxWidth: "400px",
    background: "#0b132b",
    padding: "40px 30px",
    borderRadius: "16px",
    boxShadow: "0 0 25px rgba(0,0,0,0.3)",
    textAlign: "center"
  },
  logo: {
    width: "80%",     // ✅ fit horizontally without overflowing
    maxWidth: "280px",
    margin: "0 auto 20px",
    display: "block"
  },
  title: {
    marginBottom: "20px",
    color: "#ffffff"
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "15px"
  },
  input: {
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #ccc",
    fontSize: "16px",
    outline: "none"
  },
  submitBtn: {
    padding: "12px",
    backgroundColor: "#1c7ed6",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "16px",
    cursor: "pointer"
  },
  toggleBtn: {
    marginTop: "20px",
    background: "none",
    border: "none",
    color: "#74c0fc",
    cursor: "pointer",
    fontSize: "14px",
    textDecoration: "underline"
  }
};

export default Auth;
