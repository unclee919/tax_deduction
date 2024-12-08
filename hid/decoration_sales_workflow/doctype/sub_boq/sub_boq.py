@frappe.whitelist()
def map_bo_to_lead(project_name, main_boq):
    """
    Map BOQ from Main Doctype to Lead DocType safely, handling updates and inserts.
    """
    import json
    main_boq = json.loads(main_boq) if isinstance(main_boq, str) else main_boq

    # Fetch the Lead document by project_name or create a new one
    lead_doc = frappe.db.get_value("Lead", {"custom_project_name": project_name}, "name")
    if not lead_doc:
        lead_doc = frappe.get_doc({
            "doctype": "Lead",
            "custom_project_name": project_name,
            "lead_name": f"Project - {project_name}"
        }).insert()
    else:
        lead_doc = frappe.get_doc("Lead", lead_doc)

    # Map rows from Main Doctype's BOQ to Lead's custom_bill_of_quantity
    lead_boq_map = {row.name: row for row in lead_doc.get("custom_bill_of_quantity", [])}
    for row in main_boq:
        row_name = row.get("name")
        if row_name in lead_boq_map:
            # Update existing row
            lead_row = lead_boq_map[row_name]
            for key, value in row.items():
                if key in lead_row:
                    lead_row[key] = value
        else:
            # Insert new row
            lead_doc.append("custom_bill_of_quantity", row)

    try:
        lead_doc.save()
        frappe.db.commit()
        return {"status": "success", "message": "BOQ mapped successfully"}
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "BOQ Mapping Error")
        return {"status": "error", "message": str(e)}
