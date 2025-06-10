import React, { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  deleteDoc,
  doc
} from "firebase/firestore";
import { auth, db } from "./firebase";
import Auth from "./components/Auth";
import UploadForm from "./components/UploadForm";
import ManualEntryForm from "./components/ManualEntryForm";
import "./App.css";


const testConnection = async () => {
  try {
    const docRef = await addDoc(collection(db, "test_connection"), {
      message: "Testing Firestore connection",
      timestamp: new Date()
    });
    console.log("✅ Firestore write succeeded with ID:", docRef.id);
    alert("✅ Firebase is connected. Test document written!");
  } catch (error) {
    console.error("❌ Firebase connection failed:", error);
    alert("❌ Firebase connection failed: " + error.message);
  }
};

function App() {
  const [user, setUser] = useState(null);
  const [records, setRecords] = useState([]);
  const [history, setHistory] = useState([]);
  const [searchKey, setSearchKey] = useState("");
  const [searchField, setSearchField] = useState("UniqueNo");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log("🔥 Auth State Changed. User:", currentUser);
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    try {
      const batch = records.map(record =>
        addDoc(collection(db, "fleet_records"), {
          ...record,
          createdBy: user.email,
          createdAt: new Date(),
          isCurrent: true,
          versionDate: new Date()
        })
      );
      await Promise.all(batch);
      alert("Records saved to Firestore!");
    } catch (error) {
      alert("Error saving records: " + error.message);
    }
  };

  const handleSearch = async () => {
    try {
      // Get all versions (full history)
      const hq = query(collection(db, "fleet_records"), where(searchField, "==", searchKey));
      const hSnapshot = await getDocs(hq);
      const allVersions = [];
      const currentOnly = [];

      hSnapshot.forEach((docSnap) => {
        const row = { id: docSnap.id, ...docSnap.data() };

        // ✅ Treat missing isCurrent as true (for old records)
        if (row.isCurrent === undefined) {
          row.isCurrent = true;
        }

        allVersions.push(row);
        if (row.isCurrent === true) currentOnly.push(row);
      });

      setRecords(currentOnly);
      setHistory(allVersions);
    } catch (error) {
      alert("Search failed: " + error.message);
    }
  };

  const handleUpdate = async (row) => {
    try {
      const { id, ...rest } = row;
      const cleanData = {};
      for (const key in rest) {
        cleanData[key] =
          typeof rest[key] === "string" || typeof rest[key] === "number"
            ? rest[key]
            : String(rest[key] ?? "");
      }

      await updateDoc(doc(db, "fleet_records", id), {
        isCurrent: false,
        expiredAt: new Date(),
        modifiedBy: user.email
      });

      const newVersion = {
        ...cleanData,
        createdAt: new Date(),
        createdBy: user.email,
        isCurrent: true,
        versionDate: new Date()
      };

      const docRef = await addDoc(collection(db, "fleet_records"), newVersion);

      const updatedRecords = records.map((r) =>
        r.id === id ? { ...newVersion, id: docRef.id } : r
      );
      setRecords(updatedRecords);
      handleSearch();

      alert("🆕 SCD Type 2 update saved successfully.");
    } catch (error) {
      alert("❌ Update failed: " + error.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, "fleet_records", id));
      setRecords(records.filter((r) => r.id !== id));
      alert("🗑️ Record deleted successfully.");
    } catch (error) {
      alert("❌ Delete failed: " + error.message);
    }
  };

  if (!user) return <Auth />;

  return (
    <div style={{ padding: 20 }}>
      <h2>Welcome, {user.email}</h2>
      <button onClick={() => signOut(auth)}>Logout</button>
      <br />
      <button onClick={testConnection}>Test Firebase Connection</button>
      <hr />

      <UploadForm onDataParsed={(data) => setRecords([...records, ...data])} />
      <ManualEntryForm onAddRow={(row) => setRecords([...records, row])} />

      <hr />
      <h4>Search Existing Records</h4>
      <select value={searchField} onChange={(e) => setSearchField(e.target.value)}>
        <option value="UniqueNo">UniqueNo</option>
        <option value="Broker">Broker</option>
      </select>
      <input
        type="text"
        placeholder="Search value"
        value={searchKey}
        onChange={(e) => setSearchKey(e.target.value)}
        style={{ margin: "0 10px" }}
      />
      <button onClick={handleSearch}>Search</button>

      <hr />
      <h4>Editable Current Records</h4>
      <div className="table-scroll-x">
      <table>
        <thead>
          <tr>
            {records[0] && Object.keys(records[0]).filter(k => k !== 'id').map((col) => (
              <th key={col}>{col}</th>
            ))}
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {records.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {Object.keys(row).filter(k => k !== 'id').map((col, colIndex) => (
                <td key={colIndex}>
                  <input
                    type="text"
                    value={records[rowIndex][col] || ""}
                    onChange={(e) => {
                      const updated = [...records];
                      updated[rowIndex][col] = e.target.value;
                      setRecords(updated);
                    }}
                    style={{ width: "100px" }}
                  />
                </td>
              ))}
              <td>
                <button onClick={() => handleUpdate(records[rowIndex])}>Save</button>
                <button
                  onClick={() => {
                    if (window.confirm("Are you sure you want to delete this record?")) {
                      handleDelete(records[rowIndex].id);
                    }
                  }}
                  style={{ marginLeft: "8px", color: "red" }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {history.length > 0 && (
  <>
    <hr />
    <h4>🔍 Full Version History</h4>

    {/* ✅ Dynamically build all unique columns across all rows */}
    {(() => {
      const allKeys = new Set();
      history.forEach(row => Object.keys(row).forEach(k => allKeys.add(k)));
      const columnList = Array.from(allKeys);

      return (
        <div className="table-scroll-x">
  <table>
    <thead>
      <tr>
        {columnList.map((col) => (
          <th key={col}>{col}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {history.map((row, i) => (
        <tr key={i}>
          {columnList.map((col, j) => (
            <td key={j}>
              {typeof row[col] === 'object' && row[col]?.seconds
                ? new Date(row[col].seconds * 1000).toLocaleString()
                : String(row[col] ?? "")}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
</div>
      );
    })()}
  </>
)}

    </div>
  );
}

export default App;
