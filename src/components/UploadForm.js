import React, { useState } from "react";
import * as XLSX from "xlsx";

const UploadForm = ({ onDataParsed }) => {
  const [filename, setFilename] = useState("");

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      onDataParsed(data);
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div style={{ marginTop: 20 }}>
      <h4>Upload Excel File</h4>
      <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} />
      {filename && <p>Uploaded: {filename}</p>}
    </div>
  );
};

export default UploadForm;