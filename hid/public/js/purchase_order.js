frappe.ui.form.on('Purchase Order', {
    schedule_date: function (frm) {
        // Get the new schedule_date value from the parent field
        const new_schedule_date = frm.doc.schedule_date;

        // Loop through all rows in the "items" child table
        frm.doc.items.forEach(row => {
            // Update the schedule_date field in each row
            frappe.model.set_value(row.doctype, row.name, 'schedule_date', new_schedule_date);
        });

        // Refresh the "items" field to reflect changes in the child table
        frm.refresh_field('items');
    }
});
