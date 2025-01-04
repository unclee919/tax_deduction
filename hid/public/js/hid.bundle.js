// image_view_custom.bundle.js

// -----------------------------

// Override frappe.views.ImageView Class


frappe.provide("frappe.views");


frappe.views.ImageView = class ImageViewCustom extends frappe.views.ImageView {
    item_details_html(item) {
        console.log("hi");
        // TODO: Image view field in DocType
        let info_fields = this.get_fields_in_list_view().map((el) => el.fieldname) || [];
        const title_field = this.meta.title_field || "name";
        info_fields = info_fields.filter((field) => field !== title_field);
        let info_html = `<div><ul class="list-unstyled image-view-info">`;
        let set = false;
        info_fields.forEach((field, index) => {
            if (item[field] && !set) {
                if (index == 0) info_html += `<li>${__(item[field])}</li>`;
                else info_html += `<li class="text-muted">${__(item[field])}</li>`;
                // set = true; // Comment
            }
        });
        info_html += `</ul></div>`;
        return info_html;
    }
}