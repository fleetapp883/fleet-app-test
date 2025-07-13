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
import 'react-confirm-alert/src/react-confirm-alert.css';
import { confirmAlert } from 'react-confirm-alert';






const fixedFieldsInitial = {
  date: "",
  deliveryDate: "",
  months: "",
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
  const [indentNumber, setIndentNumber] = useState(null);
  const [docId, setDocId] = useState(null);

  const [showCustomer, setShowCustomer] = useState(false);
  const [showVendor, setShowVendor] = useState(false);
  const [showPod, setShowPod] = useState(false);

  const [customerSaved, setCustomerSaved] = useState(false);
  const [vendorSaved, setVendorSaved] = useState(false);
  const [podSaved, setPodSaved] = useState(false);



  useEffect(() => {
    const storedIndentNo = localStorage.getItem("inProgressIndentNumber");
    const storedFixed = localStorage.getItem("fixedFields");
    const storedCustomer = localStorage.getItem("customerFields");
    const storedVendor = localStorage.getItem("vendorFields");
    const storedPod = localStorage.getItem("podFields");
    const storedDocId = localStorage.getItem("docId");
    
    
    if (storedDocId) setDocId(storedDocId);
    if (storedIndentNo) setIndentNumber(Number(storedIndentNo));
    if (storedFixed) setFixedFields(JSON.parse(storedFixed));
    if (storedCustomer) setCustomerData(JSON.parse(storedCustomer));
    if (storedVendor) setVendorData(JSON.parse(storedVendor));
    if (storedPod) setPodData(JSON.parse(storedPod));
  }, []);

  const formatLabel = (key) => {
  if (key === "date") return "Placement Date";
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (str) => str.toUpperCase());
};

  const resetAll = () => {
  setFixedFields(fixedFieldsInitial);
  setCustomerData(customerFields);
  setVendorData(vendorFields);
  setPodData(podFields);
  setIndentNumber(null);
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
  localStorage.removeItem("inProgressIndentNumber");
  localStorage.removeItem("docId");
};

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


  const getNextIndentNumber = async () => {
  const counterRef = doc(db, "Counters", "fleet_counter");
  const newIndentNo = await runTransaction(db, async (transaction) => {
    const docSnap = await transaction.get(counterRef);
    if (!docSnap.exists()) throw new Error("Counter doc missing");
    const current = docSnap.data().nextFleetNo || 1;
    transaction.update(counterRef, { nextFleetNo: current + 1 });
    return current;
  });
  return newIndentNo;
};


  const handleFixedSave = async () => {
    const hasAnyValue = Object.values(fixedFields).some(
  val => String(val ?? "").trim() !== ""
);

if (!hasAnyValue) {
  confirmAlert({
    title: 'Validation Error',
    message: '⚠️ Please fill at least one field before continuing.',
    buttons: [
      {
        label: 'OK'
      }
    ]
  });
  return;
}


    try {
      const user = auth.currentUser;
      const indentNo  = await getNextIndentNumber();
      const enrichedData = {
        indentNumber: indentNo,
        ...convertDateFields(fixedFields, ["date","deliveryDate"]),
        createdAt: new Date(),
        createdBy: user?.email || "anonymous",
        isCurrent: true,
        versionDate: new Date(),
        updateDescription: ""
      };

      const docRef = await addDoc(collection(db, "fleet_records"), enrichedData);
      setIndentNumber(indentNo);
      setDocId(docRef.id);
      localStorage.setItem("docId", docRef.id);
      localStorage.setItem("inProgressIndentNumber", indentNo);
      await navigator.clipboard.writeText(String(indentNo));
      confirmAlert({
  title: 'Success',
  message: `✅ Fixed fields saved. Indent Number copied: ${indentNo}`,
  buttons: [
    { label: 'OK' }
  ]
});

    } catch (err) {
      confirmAlert({
  title: 'Error',
  message: "❌ Error saving fixed fields: " + err.message,
  buttons: [{ label: 'OK' }]
});

    }
  };

  const saveSection = async (sectionName, sectionData, dateFields = []) => {
    if (!docId) {
  confirmAlert({
    title: 'Missing Info',
    message: '⚠️ Save fixed fields first.',
    buttons: [{ label: 'OK' }]
  });
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
      confirmAlert({
  title: 'Saved',
  message: `✅ ${sectionName} saved.`,
  buttons: [{ label: 'OK' }]
});

    } catch (err) {
      confirmAlert({
  title: 'Error',
  message: "❌ Save error: " + err.message,
  buttons: [{ label: 'OK' }]
});

    }
  };

 const handleFinalSubmit = async () => {
  if (!docId) {
  confirmAlert({
    title: 'Error',
    message: 'Fleet data not ready.',
    buttons: [{ label: 'OK' }]
  });
  return;
}


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
  if (!docSnap.exists()) {
  confirmAlert({
    title: 'Error',
    message: 'Data not found.',
    buttons: [{ label: 'OK' }]
  });
  return;
}

  const data = { id: docSnap.id, ...docSnap.data() };
  onAddRow(flattenObject(data), true);
  localStorage.setItem("latestSearchField", "indentNumber");
  localStorage.setItem("latestSearchKey", String(data.indentNumber));



  // Reset all state
  setFixedFields(fixedFieldsInitial);
  setCustomerData(customerFields);
  setVendorData(vendorFields);
  setPodData(podFields);
  setIndentNumber(null);
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
  localStorage.removeItem("inProgressIndentNumber");
  localStorage.removeItem("docId");



  confirmAlert({
  title: 'Done',
  message: '✅ Record submitted and ready in editable table.',
  buttons: [{ label: 'OK' }]
});

};

const handleNewRecord = () => {
  confirmAlert({
    title: 'Confirm New Entry',
    message: 'Start a new entry? Unsaved data will be lost.',
    buttons: [
      {
        label: 'Yes',
        onClick: () => {
          resetAll();
          confirmAlert({
            title: 'Ready',
            message: '🆕 Ready to start a new record.',
            buttons: [{ label: 'OK' }]
          });
        }
      },
      {
        label: 'No'
      }
    ]
  });
};



  return (
    <div style={{ marginTop: 20 }}>
      <h4>Step 1: Fixed Fields</h4>
<div className="card p-4 mb-4">
  <div
    className="fixed-fields-grid"
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(5, 1fr)",
      gap: "16px",
    }}
  >
    {Object.keys(fixedFieldsInitial).map((key) => {
      const isDate = key.toLowerCase().includes("date");
      const label =
        isDate
          ? `${key} (dd/mm/yyyy)`
          : key === "months"
          ? "months (e.g. Jul-2025)"
          : key;

      return (
        <div key={key}>
          <label className="form-label" style={{ fontWeight: "500" }}>
  {formatLabel(key)}
</label>
{(key === "date" || key === "deliveryDate") ? (
  <input
    type="date"
    name={key}
    className="form-control"
    value={fixedFields[key]}
    onChange={handleFixedChange}
    disabled={!!indentNumber}
  />
) : (
  <input
    name={key}
    className="form-control"
    placeholder=""
    value={fixedFields[key]}
    onChange={handleFixedChange}
    disabled={!!indentNumber}
    type="text"
  />
)}


        </div>
      );
    })}
  </div>

  {!indentNumber && (
  <div style={{ marginTop: "20px", width: "100%", textAlign: "right" }}>
    <button className="btn btn-primary" onClick={handleFixedSave}>
      💾 Save & Continue
    </button>
  </div>
)}

 

</div>


      {indentNumber  && (
        <>
          <p style={{ color: "green" }}>✅ Saved. Indent No: {indentNumber}</p>

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
    <div className="card p-3 mb-3">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "16px",
        }}
      >
        {Object.keys(customerFields).map((key) => {
          const isDate = ["advanceRecDate", "balanceRecDate"].includes(key);
          const label = isDate ? `${key} (dd/mm/yyyy)` : key;
          return (
            <div key={key}>
              <label className="form-label" style={{ fontWeight: "500" }}>
  {formatLabel(key)}
</label>
<input
  name={key}
  className="form-control"
  placeholder=""
  value={customerData[key]}
  onChange={(e) => handleSectionChange(e, "customer")}
  disabled={customerSaved}
  type={isDate ? "date" : "text"}
/>

            </div>
          );
        })}
      </div>
      {!customerSaved && (
  <div style={{ textAlign: "right", marginTop: "16px" }}>
    <button
      className="btn btn-primary"
      onClick={() => saveSection("customerMaster", customerData, ["advanceRecDate", "balanceRecDate"])}
    >
      Save Customer
    </button>
  </div>
)}

    </div>
  </>
)}


          {showVendor && (
  <>
    <h5>Vendor Master</h5>
    <div className="card p-3 mb-3">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "16px",
        }}
      >
        {Object.keys(vendorFields).map((key) => {
          const label = key;
          return (
            <div key={key}>
              <label className="form-label" style={{ fontWeight: "500" }}>
  {formatLabel(key)}
</label>
<input
  name={key}
  className="form-control"
  placeholder=""
                value={vendorData[key]}
                onChange={(e) => handleSectionChange(e, "vendor")}
                disabled={vendorSaved}
                type="text"
              />
            </div>
          );
        })}
      </div>
      {!vendorSaved && (
        <div style={{ textAlign: "right", marginTop: "16px" }}>
        <button className="btn btn-primary mt-3" onClick={() => saveSection("vendorMaster", vendorData)}>
          Save Vendor
        </button>
        </div>
      )}
    </div>
  </>
)}


          {showPod && (
  <>
    <h5>POD Master</h5>
    <div className="card p-3 mb-3">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "16px",
        }}
      >
        {Object.keys(podFields).map((key) => {
          const isDate = ["podVendorDate", "podSendToCustomerDate", "podCustomerRec", "today"].includes(key);
          const label = isDate ? `${key} (dd/mm/yyyy)` : key;
          return (
            <div key={key}>
              <label className="form-label" style={{ fontWeight: "500" }}>
  {formatLabel(key)}
            </label>
              <input
                name={key}
                className="form-control"
                placeholder=""
                value={podData[key]}
                onChange={(e) => handleSectionChange(e, "pod")}
                disabled={podSaved}
                type={isDate ? "date" : "text"}
              />

            </div>
          );
        })}
      </div>
      {!podSaved && (
        <div style={{ textAlign: "right", marginTop: "16px" }}>
        <button className="btn btn-primary mt-3" onClick={() => saveSection("podMaster", podData, ["podVendorDate", "podSendToCustomerDate", "podCustomerRec", "today"])}>
          Save POD
        </button>
        </div>
      )}
    </div>
  </>
)}


          <br />
          <div style={{ marginTop: 10, width: "100%", textAlign: "right" }}>
  <button onClick={handleFinalSubmit} className="btn btn-success me-2">
    ✅ Submit Record
  </button>
  <button onClick={handleNewRecord} className="btn btn-primary">
    ➕ Add New Record
  </button>
</div>

        </>
      )}
    </div>
  );
};

export default ManualEntryForm;
