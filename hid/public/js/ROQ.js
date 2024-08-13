// import frappe
// from frappe.utils import nowdate

// @frappe.whitelist()
// def create_quotations_from_material_request(material_request_name):
//     try:
//         # Get the material request document
//         material_request = frappe.get_doc('Material Request', material_request_name)
        
//         # Group items by supplier
//         supplier_items = {}
//         for item in material_request.items:
//             if item.supplier:
//                 if item.supplier not in supplier_items:
//                     supplier_items[item.supplier] = []
//                 supplier_items[item.supplier].append(item)
        
//         # Create quotations based on grouped suppliers
//         for supplier, items in supplier_items.items():
//             rfq = frappe.get_doc({
//                 'doctype': 'Request for Quotation',
//                 'supplier': supplier,
//                 'transaction_date': nowdate(),
//                 'status': 'Draft'
//             })
            
//             for item in items:
//                 rfq.append('items', {
//                     'item_code': item.item_code,
//                     'qty': item.qty,
//                     'rate': item.rate,
//                     'uom': item.uom
//                 })
            
//             # Save RFQ (optional, can be removed if you want to keep it as a draft)
//             rfq.insert(ignore_permissions=True)
//             # rfq.submit() # Uncomment if you want to submit RFQ immediately

//         frappe.db.commit()
//         return "Quotations created successfully"
//     except Exception as e:
//         frappe.log_error(frappe.get_traceback(), "Error in creating quotations from Material Request")
//         return str(e)
