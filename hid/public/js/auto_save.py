import frappe

@frappe.whitelist()
def auto_fill_rows(docname, fieldname, value, selected_rows):
    """
    Update specific fields in selected rows of a child table.

    Args:
        docname (str): The Lead document name.
        fieldname (str): The field name to update.
        value (str): The value to set.
        selected_rows (list): List of selected row indices.
    """
    doc = frappe.get_doc("Lead", docname)
    selected_rows = frappe.parse_json(selected_rows)

    for row in doc.child_table_field:  # Replace `child_table_field` with your child table fieldname
        if row.idx in selected_rows:
            setattr(row, fieldname, value)
    doc.save()
    return "Fields updated successfully"
