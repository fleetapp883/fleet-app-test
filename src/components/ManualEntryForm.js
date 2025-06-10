import React, { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db, auth } from "../firebase";

const ManualEntryForm = ({ onAddRow }) => {
  const [formData, setFormData] = useState({
    UniqueNo: "",
    Date: "",
    Origin: "",
    Dest: "",
    Broker: "",
    Mode: "",
    SaleRate: "",
    Profit: ""
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const user = auth.currentUser;
      const enrichedData = {
        ...formData,
        createdAt: new Date(),
        createdBy: user?.email || "anonymous"
      };

      // ✅ Save to Firestore
      await addDoc(collection(db, "fleet_records"), enrichedData);

      // ✅ Also pass it to parent (for display in table)
      onAddRow(enrichedData);

      setFormData({
        UniqueNo: "",
        Date: "",
        Origin: "",
        Dest: "",
        Broker: "",
        Mode: "",
        SaleRate: "",
        Profit: ""
      });

      alert("✅ Row saved to Firestore!");
    } catch (err) {
      alert("❌ Error saving row: " + err.message);
    }
  };

  return (
    <div style={{ marginTop: 20 }}>
      <h4>Manual Entry</h4>
      <form onSubmit={handleSubmit}>
        {Object.keys(formData).map((key) => (
          <input
            key={key}
            name={key}
            placeholder={key}
            value={formData[key]}
            onChange={handleChange}
            style={{ margin: 4 }}
            required
          />
        ))}
        <br />
        <button type="submit">Add Row</button>
      </form>
    </div>
  );
};

export default ManualEntryForm;
