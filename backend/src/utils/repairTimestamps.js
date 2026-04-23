import { prisma } from "../lib/prisma.js";

let repairPromise;

const repairStatements = [
  {
    tableName: "SuperAdmin",
    columns: ["lastLoginAt", "createdAt", "updatedAt"],
    nullableColumns: ["lastLoginAt"],
  },
  {
    tableName: "Business",
    columns: ["createdAt", "updatedAt"],
    nullableColumns: [],
  },
  {
    tableName: "BusinessAdmin",
    columns: ["createdAt", "updatedAt"],
    nullableColumns: [],
  },
  {
    tableName: "ControlToggles",
    columns: ["updatedAt"],
    nullableColumns: [],
  },
  {
    tableName: "Customer",
    columns: ["createdAt", "updatedAt"],
    nullableColumns: [],
  },
  {
    tableName: "Conversation",
    columns: ["lastMessageAt", "createdAt", "updatedAt"],
    nullableColumns: [],
  },
  {
    tableName: "Message",
    columns: ["approvalSeenAt", "createdAt"],
    nullableColumns: ["approvalSeenAt"],
  },
  {
    tableName: "PlatformMetric",
    columns: ["createdAt", "updatedAt"],
    nullableColumns: [],
  },
];

const isInvalidDateCondition = (columnName) =>
  `\`${columnName}\` IS NULL OR \`${columnName}\` < '1000-01-01 00:00:00'`;

const buildRepairSql = ({ tableName, columnName, nullableColumn }) => {
  const replacementValue = nullableColumn ? "NULL" : "NOW()";
  return `UPDATE \`${tableName}\` SET \`${columnName}\` = ${replacementValue} WHERE ${isInvalidDateCondition(columnName)}`;
};

export const ensureDatabaseTimestampsAreValid = async () => {
  if (!repairPromise) {
    repairPromise = (async () => {
      for (const table of repairStatements) {
        for (const columnName of table.columns) {
          const sql = buildRepairSql({
            tableName: table.tableName,
            columnName,
            nullableColumn: table.nullableColumns.includes(columnName),
          });

          try {
            const affectedRows = await prisma.$executeRawUnsafe(sql);
            if (affectedRows > 0) {
              console.info("[Database] Repaired invalid timestamp values", {
                table: table.tableName,
                column: columnName,
                affectedRows,
              });
            }
          } catch (error) {
            console.error("[Database] Timestamp repair failed", {
              table: table.tableName,
              column: columnName,
              message: error.message,
            });
          }
        }
      }
    })();
  }

  return repairPromise;
};
