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





// image_view_custom.bundle.js

// -----------------------------

// Override frappe.views.ImageView Class


frappe.provide("frappe.views");


frappe.views.ImageView = class ImageViewCustom extends frappe.views.ImageView {
    item_details_html(item) {
        // TODO: Image view field in DocType
        let info_fields = this.get_fields_in_list_view().map((el) => el) || [];
        const title_field = this.meta.title_field || "name";
        info_fields = info_fields.filter((field) => field.fieldname !== title_field);
        let info_html = `<div><ul class="list-unstyled image-view-info">`;
        let set = false;
        info_fields.forEach((field, index) => {
            if (item[field.fieldname] && !set) {
                if (index == 0) info_html += `<li><b>${__(field.label)}: </b> ${__(item[field.fieldname])}</li>`;
                else info_html += `<li class="text-muted"><b>${__(field.label)}: </b> ${__(item[field.fieldname])}</li>`;
                // set = true; // Comment
            }
        });
        info_html += `</ul></div>`;
        return info_html;
    }
}
