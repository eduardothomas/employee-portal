# kotlinx.serialization
-keepattributes *Annotation*, InnerClasses
-keepclassmembers class com.employeeportal.** { *** Companion; }
-keepclasseswithmembers class com.employeeportal.** { kotlinx.serialization.KSerializer serializer(...); }
-dontwarn org.slf4j.**
