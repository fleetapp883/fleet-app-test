import React, { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  runTransaction,
  Timestamp,
  getDoc
} from "firebase/firestore";
import { db, auth } from "../firebase";





const fixedFieldsInitial = {
  date: "",
  months: "",
  indentNo: "",
  origin: "",
  destination: "",
  customer: "",
  customerType: "",
  vehicleNo: "",
  vendor: "",
  salesRate: "",
  buyRate: ""
};

const customerFields = {
  toBeAdvance: "",
  advanceReceived: "",
  advDeviation: "",
  advanceRecDate: "",
  validatedAdvanceUTRDescription: "",
  validatedAdvanceAmount: "",
  balance: "",
  processingCharges: "",
  inwardMisCharges: "",
  outwardMisCharges: "",
  balanceReceived: "",
  remainingBalance: "",
  balanceRecDate: "",
  validatedBalanceUTR: "",
  validatedBalanceUTRAmount: ""
};

const vendorFields = {
  vendorOutwardPayment: "",
  paidAmount: "",
  balancePending: "",
  vendorRemark: ""
};

const podFields = {
  podVendorDate: "",
  podSendToCustomerDate: "",
  docNo: "",
  podCustomerRec: "",
  today: "",
  balanceOverdueDays: "",
  toBeCollectedAmount: ""
};
const flattenObject = (obj, prefix = "") => {
  let result = {};
  for (const key in obj) {
    const value = obj[key];
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !value.seconds) {
      Object.assign(result, flattenObject(value, fullKey));
    } else {
      result[fullKey] = value;
    }
  }
  return result;
};

const ManualEntryForm = ({ onAddRow }) => {
  const [fixedFields, setFixedFields] = useState(fixedFieldsInitial);
  const [customerData, setCustomerData] = useState(customerFields);
  const [vendorData, setVendorData] = useState(vendorFields);
  const [podData, setPodData] = useState(podFields);
  const [fleetNumber, setFleetNumber] = useState(null);
  const [docId, setDocId] = useState(null);

  const [showCustomer, setShowCustomer] = useState(false);
  const [showVendor, setShowVendor] = useState(false);
  const [showPod, setShowPod] = useState(false);

  const [customerSaved, setCustomerSaved] = useState(false);
  const [vendorSaved, setVendorSaved] = useState(false);
  const [podSaved, setPodSaved] = useState(false);

  useEffect(() => {
    const storedFleetNo = localStorage.getItem("inProgressFleetNumber");
    const storedFixed = localStorage.getItem("fixedFields");
    const storedCustomer = localStorage.getItem("customerFields");
    const storedVendor = localStorage.getItem("vendorFields");
    const storedPod = localStorage.getItem("podFields");
    const storedDocId = localStorage.getItem("docId");
    
    
    if (storedDocId) setDocId(storedDocId);
    if (storedFleetNo) setFleetNumber(Number(storedFleetNo));
    if (storedFixed) setFixedFields(JSON.parse(storedFixed));
    if (storedCustomer) setCustomerData(JSON.parse(storedCustomer));
    if (storedVendor) setVendorData(JSON.parse(storedVendor));
    if (storedPod) setPodData(JSON.parse(storedPod));
  }, []);

  const convertDateFields = (data, allowedKeys = []) => {
    const result = {};
    Object.entries(data).forEach(([key, value]) => {
      if (allowedKeys.includes(key) && value) {
        const parsed = new Date(value);
        result[key] = isNaN(parsed) ? value : Timestamp.fromDate(parsed);
      } else {
        result[key] = value;
      }
    });
    return result;
  };

  const handleFixedChange = (e) => {
  const updated = { ...fixedFields, [e.target.name]: e.target.value };
  setFixedFields(updated);
  localStorage.setItem("fixedFields", JSON.stringify(updated));  // ✅ Save
};


  const handleSectionChange = (e, section) => {
  const { name, value } = e.target;
  if (section === "customer") {
    const updated = { ...customerData, [name]: value };
    setCustomerData(updated);
    localStorage.setItem("customerFields", JSON.stringify(updated));
  }
  if (section === "vendor") {
    const updated = { ...vendorData, [name]: value };
    setVendorData(updated);
    localStorage.setItem("vendorFields", JSON.stringify(updated));
  }
  if (section === "pod") {
    const updated = { ...podData, [name]: value };
    setPodData(updated);
    localStorage.setItem("podFields", JSON.stringify(updated));
  }
};


  const getNextFleetNumber = async () => {
    const counterRef = doc(db, "Counters", "fleet_counter");
    const newFleetNo = await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(counterRef);
      if (!docSnap.exists()) throw new Error("Counter doc missing");
      const current = docSnap.data().nextFleetNo || 1;
      transaction.update(counterRef, { nextFleetNo: current + 1 });
      return current;
    });
    return newFleetNo;
  };

  const handleFixedSave = async () => {
    try {
      const user = auth.currentUser;
      const fleetNo = await getNextFleetNumber();
      const enrichedData = {
        fleetNumber: fleetNo,
        ...convertDateFields(fixedFields, ["date"]),
        createdAt: new Date(),
        createdBy: user?.email || "anonymous",
        isCurrent: true,
        versionDate: new Date(),
        updateDescription: ""
      };

      const docRef = await addDoc(collection(db, "fleet_records"), enrichedData);
      setFleetNumber(fleetNo);
      setDocId(docRef.id);
      localStorage.setItem("docId", docRef.id);
      localStorage.setItem("inProgressFleetNumber", fleetNo);
      await navigator.clipboard.writeText(String(fleetNo));
      alert(`✅ Fixed fields saved. Fleet Number copied: ${fleetNo}`);
    } catch (err) {
      alert("❌ Error saving fixed fields: " + err.message);
    }
  };

  const saveSection = async (sectionName, sectionData, dateFields = []) => {
    if (!docId) {
      alert("⚠️ Save fixed fields first.");
      return;
    }
    try {
      const docRef = doc(db, "fleet_records", docId);
      await updateDoc(docRef, {
        [`${sectionName}`]: convertDateFields(sectionData, dateFields)
      });
      if (sectionName === "customerMaster") setCustomerSaved(true);
      if (sectionName === "vendorMaster") setVendorSaved(true);
      if (sectionName === "podMaster") setPodSaved(true);
      alert(`✅ ${sectionName} saved.`);
    } catch (err) {
      alert("❌ Save error: " + err.message);
    }
  };

 const handleFinalSubmit = async () => {
  if (!docId) return alert("Fleet data not ready.");

  // Save any unsaved sections first
  if (showCustomer && !customerSaved) {
    await saveSection("customerMaster", customerData, ["advanceRecDate", "balanceRecDate"]);
  }
  if (showVendor && !vendorSaved) {
    await saveSection("vendorMaster", vendorData);
  }
  if (showPod && !podSaved) {
    await saveSection("podMaster", podData, ["podVendorDate", "podSendToCustomerDate", "podCustomerRec", "today"]);
  }

  const docSnap = await getDoc(doc(db, "fleet_records", docId));
  if (!docSnap.exists()) return alert("Data not found.");
  const data = { id: docSnap.id, ...docSnap.data() };
  onAddRow(flattenObject(data), true);


  // Reset all state
  setFixedFields(fixedFieldsInitial);
  setCustomerData(customerFields);
  setVendorData(vendorFields);
  setPodData(podFields);
  setFleetNumber(null);
  setDocId(null);
  setShowCustomer(false);
  setShowVendor(false);
  setShowPod(false);
  setCustomerSaved(false);
  setVendorSaved(false);
  setPodSaved(false);

  localStorage.removeItem("fixedFields");
  localStorage.removeItem("customerFields");
  localStorage.removeItem("vendorFields");
  localStorage.removeItem("podFields");
  localStorage.removeItem("inProgressFleetNumber");
  localStorage.removeItem("docId");



  alert("✅ Record submitted and ready in editable table.");
};


  return (
    <div style={{ marginTop: 20 }}>
      <h4>Step 1: Fixed Fields</h4>
      {Object.keys(fixedFieldsInitial).map((key) => {
        const isDate = key.toLowerCase().includes("date");
        const label = isDate ? `${key} (dd/mm/yyyy)` : key === "months" ? "months (e.g. Jul-2025)" : key;
        return (
          <input
            key={key}
            name={key}
            placeholder={label}
            value={fixedFields[key]}
            onChange={handleFixedChange}
            disabled={!!fleetNumber}
            style={{ margin: 4, width: "220px" }}
          />
        );
      })}
      {!fleetNumber && (
        <button onClick={handleFixedSave}>💾 Save & Continue</button>
      )}
      {fleetNumber && (
        <>
          <p style={{ color: "green" }}>✅ Saved. Fleet No: {fleetNumber}</p>

          <h4>Step 2: Select Master Sections</h4>
          <label>
            <input type="checkbox" checked={showCustomer} onChange={() => setShowCustomer(!showCustomer)} disabled={customerSaved} /> Customer Master
          </label>
          <label style={{ marginLeft: 15 }}>
            <input type="checkbox" checked={showVendor} onChange={() => setShowVendor(!showVendor)} disabled={vendorSaved} /> Vendor Master
          </label>
          <label style={{ marginLeft: 15 }}>
            <input type="checkbox" checked={showPod} onChange={() => setShowPod(!showPod)} disabled={podSaved} /> POD Master
          </label>

          {showCustomer && (
            <>
              <h5>Customer Master</h5>
              {Object.keys(customerFields).map((key) => {
                const isDate = ["advanceRecDate", "balanceRecDate"].includes(key);
                const label = isDate ? `${key} (dd/mm/yyyy)` : key;
                return (
                  <input
                    key={key}
                    name={key}
                    placeholder={label}
                    value={customerData[key]}
                    onChange={(e) => handleSectionChange(e, "customer")}
                    style={{ margin: 4, width: "220px" }}
                    disabled={customerSaved}
                  />
                );
              })}
              {!customerSaved && (
                <button onClick={() => saveSection("customerMaster", customerData, ["advanceRecDate", "balanceRecDate"])}>Save Customer</button>
              )}
            </>
          )}

          {showVendor && (
            <>
              <h5>Vendor Master</h5>
              {Object.keys(vendorFields).map((key) => (
                <input
                  key={key}
                  name={key}
                  placeholder={key}
                  value={vendorData[key]}
                  onChange={(e) => handleSectionChange(e, "vendor")}
                  style={{ margin: 4, width: "220px" }}
                  disabled={vendorSaved}
                />
              ))}
              {!vendorSaved && (
                <button onClick={() => saveSection("vendorMaster", vendorData)}>Save Vendor</button>
              )}
            </>
          )}

          {showPod && (
            <>
              <h5>POD Master</h5>
              {Object.keys(podFields).map((key) => {
                const isDate = ["podVendorDate", "podSendToCustomerDate", "podCustomerRec", "today"].includes(key);
                const label = isDate ? `${key} (dd/mm/yyyy)` : key;
                return (
                  <input
                    key={key}
                    name={key}
                    placeholder={label}
                    value={podData[key]}
                    onChange={(e) => handleSectionChange(e, "pod")}
                    style={{ margin: 4, width: "220px" }}
                    disabled={podSaved}
                  />
                );
              })}
              {!podSaved && (
                <button onClick={() => saveSection("podMaster", podData, ["podVendorDate", "podSendToCustomerDate", "podCustomerRec", "today"])}>Save POD</button>
              )}
            </>
          )}

          <br />
          <button onClick={handleFinalSubmit} style={{ marginTop: 10, backgroundColor: "#4caf50" }}>
            ✅ Submit Record
          </button>
        </>
      )}
    </div>
  );
};

export default ManualEntryForm;
