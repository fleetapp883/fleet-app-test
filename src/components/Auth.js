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
    <div style={{ padding: 40, maxWidth: 400, margin: "auto", border: "1px solid #ccc", borderRadius: 10 }}>
      <h2 style={{ textAlign: "center" }}>{isLogin ? "Login" : "Sign Up"}</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: "100%", padding: 8, marginBottom: 10 }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ width: "100%", padding: 8, marginBottom: 10 }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: 10,
            backgroundColor: "#007BFF",
            color: "white",
            border: "none",
            cursor: "pointer"
          }}
        >
          {loading ? "Please wait..." : isLogin ? "Login" : "Sign Up"}
        </button>
      </form>
      <button
        onClick={() => setIsLogin(!isLogin)}
        style={{
          marginTop: 15,
          background: "none",
          border: "none",
          color: "#007BFF",
          cursor: "pointer",
          textDecoration: "underline"
        }}
      >
        {isLogin ? "New user? Create an account" : "Already have an account? Login"}
      </button>
    </div>
  );
};

export default Auth;
