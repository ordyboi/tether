import { pgSchema, text } from "drizzle-orm/pg-core";

const informationSchema = pgSchema("information_schema");

export const informationSchemaColumns = informationSchema.table("columns", {
  tableSchema: text("table_schema"),
  tableName: text("table_name"),
  columnName: text("column_name"),
  dataType: text("data_type"),
});
